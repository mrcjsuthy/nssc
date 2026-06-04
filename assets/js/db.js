/* =========================================================
   NSSC // DB: thin wrapper around Supabase for auth + data.
   ========================================================= */

(function () {
  const ns = (window.NSSC = window.NSSC || {});
  const cfg = ns.config;

  let client = null;

  ns.db = {
    /* ---------- Lifecycle ---------- */

    isConfigured() {
      return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
    },

    client() {
      if (client) return client;
      if (!this.isConfigured()) return null;
      if (!window.supabase || !window.supabase.createClient) {
        console.warn("NSSC: supabase-js failed to load.");
        return null;
      }
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: "nssc-supabase-auth",
        },
      });
      return client;
    },

    /* ---------- Auth ---------- */

    async getSession() {
      const c = this.client();
      if (!c) return null;
      const { data } = await c.auth.getSession();
      return data.session || null;
    },

    async signUp({ email, password, name }) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");

      const { data, error } = await c.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw error;

      // If Supabase is in "confirm email" mode, signUp returns a user but
      // NO session. Without a session, the next INSERT into public.members
      // will be rejected by RLS, the trigger will already have advanced the
      // member_number sequence, and the user will end up off-by-one when
      // they finally do confirm + re-register. Surface a clear error and
      // bail out before that happens.
      if (!data.session) {
        throw new Error(
          "Email confirmation is enabled on this Supabase project. " +
          "Disable it in Auth \u2192 Providers \u2192 Email, then try again."
        );
      }
      return data.user;
    },

    async insertMemberRow({ id, name, email, teeSize, teeAddress }) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c
        .from("members")
        .insert({
          id,
          name,
          email,
          tee_claimed: Boolean(teeSize),
          tee_size: teeSize || null,
          tee_address: teeAddress || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async signInWithPassword({ identifier, password }) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");

      let email = identifier.trim();
      // If they typed a member number (NSSC-0001 etc.), resolve to email first.
      if (/^NSSC[-\s]?\d+$/i.test(email)) {
        const normalized = email
          .toUpperCase()
          .replace(/\s+/g, "")
          .replace(/^NSSC(\d)/, "NSSC-$1");
        const { data, error } = await c
          .from("members")
          .select("email")
          .eq("member_number", normalized)
          .single();
        if (error || !data) throw new Error("No such member number.");
        email = data.email;
      }

      const { data, error } = await c.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async signOut() {
      const c = this.client();
      if (!c) return;
      await c.auth.signOut();
    },

    /* ---------- Member directory ---------- */

    async getMe() {
      const c = this.client();
      if (!c) return null;
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) return null;
      const { data, error } = await c
        .from("members")
        .select("*")
        .eq("id", uid)
        .single();
      if (error) return null;
      return data;
    },

    async listMembers() {
      const c = this.client();
      if (!c) return [];
      const { data, error } = await c
        .from("members")
        .select("id, member_number, name, is_founder, can_post_events, joined_at")
        .order("member_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async setMemberFlags(id, flags) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const patch = {};
      if (typeof flags.is_founder === "boolean") patch.is_founder = flags.is_founder;
      if (typeof flags.can_post_events === "boolean") patch.can_post_events = flags.can_post_events;
      const { data, error } = await c
        .from("members")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /* ---------- Events board ---------- */

    async listUpcomingEvents() {
      const c = this.client();
      if (!c) return [];
      const { data, error } = await c
        .from("events")
        .select(
          "id, title, description, event_date, location, host_id, created_at, host:members!events_host_id_fkey(member_number, name)"
        )
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async createEvent({ title, description, eventDate, location }) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const { data, error } = await c
        .from("events")
        .insert({
          title,
          description: description || null,
          event_date: eventDate,
          location: location || null,
          host_id: uid,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async deleteEvent(id) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { error } = await c.from("events").delete().eq("id", id);
      if (error) throw error;
      return true;
    },

    /* ---------- Tee orders (founders only by RLS \u2014 founders can read all members) ---------- */

    async listTeeOrders() {
      const c = this.client();
      if (!c) return [];
      const { data, error } = await c
        .from("members")
        .select(
          "id, member_number, name, email, tee_size, tee_address, tee_claimed_at, tee_seen_at"
        )
        .eq("tee_claimed", true)
        .order("tee_claimed_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },

    async countUnseenOrders() {
      const c = this.client();
      if (!c) return 0;
      const { count, error } = await c
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("tee_claimed", true)
        .is("tee_seen_at", null);
      if (error) return 0;
      return count || 0;
    },

    async markTeeSeen(memberId) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c
        .from("members")
        .update({ tee_seen_at: new Date().toISOString() })
        .eq("id", memberId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /* ---------- World chat (24h sliding retention enforced by RLS) ---------- */

    async listChatMessages(limit) {
      const c = this.client();
      if (!c) return [];
      const { data, error } = await c
        .from("chat_messages")
        .select(
          "id, body, member_id, created_at, member:members!chat_messages_member_id_fkey(member_number, name, is_founder)"
        )
        .order("created_at", { ascending: false })
        .limit(limit || 200);
      if (error) throw error;
      return (data || []).reverse();
    },

    async postChatMessage(body) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const trimmed = (body || "").trim().slice(0, 500);
      if (!trimmed) throw new Error("Message is empty.");
      const { data, error } = await c
        .from("chat_messages")
        .insert({ body: trimmed, member_id: uid })
        .select(
          "id, body, member_id, created_at, member:members!chat_messages_member_id_fkey(member_number, name, is_founder)"
        )
        .single();
      if (error) throw error;
      return data;
    },

    async deleteChatMessage(id) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { error } = await c.from("chat_messages").delete().eq("id", id);
      if (error) throw error;
      return true;
    },

    /**
     * Subscribe to chat changes. Returns an unsubscribe function.
     * Calls onInsert(newRow) and onDelete({id}) as events arrive.
     */
    subscribeChat({ onInsert, onDelete }) {
      const c = this.client();
      if (!c) return () => {};
      const channel = c
        .channel("nssc-chat")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => onInsert && onInsert(payload.new)
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "chat_messages" },
          (payload) => onDelete && onDelete(payload.old)
        )
        .subscribe();
      return () => c.removeChannel(channel);
    },
  };
})();
