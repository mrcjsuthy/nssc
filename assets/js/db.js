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
          detectSessionInUrl: false,
          storageKey: "nssc-supabase-auth",
          storage: window.localStorage,
        },
      });
      if (!client._nsscAuthHook) {
        client._nsscAuthHook = true;
        client.auth.onAuthStateChange((event) => {
          if (event === "TOKEN_REFRESHED") void ns.db.touchPresence?.();
        });
      }
      return client;
    },

    /* ---------- Auth ---------- */

    async getSession() {
      const c = this.client();
      if (!c) return null;
      const { data } = await c.auth.getSession();
      if (data.session) return data.session;
      return this.refreshSessionIfNeeded();
    },

    async refreshSessionIfNeeded() {
      const c = this.client();
      if (!c) return null;
      try {
        const { data, error } = await c.auth.refreshSession();
        if (error) return null;
        return data.session || null;
      } catch (_) {
        return null;
      }
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

    async insertMemberRow({ id, name, email, teeSize, teeAddress, archetype }) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c
        .from("members")
        .insert({
          id,
          name,
          email,
          archetype: archetype || null,
          tee_claimed: Boolean(teeSize),
          tee_size: teeSize || null,
          tee_address: teeAddress || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async updateMyName(name) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const trimmed = String(name || "").trim();
      if (trimmed.length < 2) throw new Error("Name must be at least 2 characters.");
      if (trimmed.length > 64) throw new Error("Name is too long.");
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const { data, error } = await c
        .from("members")
        .update({ name: trimmed })
        .eq("id", uid)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /* Write-once: set my own archetype if I don't have one yet (enforced by RLS). */
    async setMyArchetype(archetype) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const { data, error } = await c
        .from("members")
        .update({ archetype })
        .eq("id", uid)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async signInWithPassword({ identifier, password }) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");

      let email = (identifier || "").trim();

      // Accept any of: "1", "0001", "NSSC0001", "NSSC-0001", "nssc 1".
      // Anything else is treated as an email.
      const memberNumberMatch = email.match(/^(?:NSSC[-\s]?)?0*(\d{1,4})$/i);
      if (memberNumberMatch) {
        const padded = "NSSC-" + memberNumberMatch[1].padStart(4, "0");
        // We're not signed in yet, so RLS on `members` would block a direct
        // SELECT. The `email_for_member_number` RPC is SECURITY DEFINER and
        // explicitly granted to anon for this single lookup.
        const { data, error } = await c.rpc("email_for_member_number", {
          p_member_number: padded,
        });
        if (error) {
          throw new Error(
            "Login lookup failed. Make sure the latest schema.sql has been run in Supabase. (" +
              error.message +
              ")"
          );
        }
        if (!data) throw new Error("No member " + padded + ".");
        email = data;
      }

      const { data, error } = await c.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async signOut() {
      const c = this.client();
      if (!c) return;
      await c.auth.signOut({ scope: "local" });
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

    async getMemberHudStats() {
      const c = this.client();
      if (!c) return null;
      const { data, error } = await c.rpc("member_hud_stats");
      if (error) {
        console.warn("NSSC: member_hud_stats failed:", error.message);
        return null;
      }
      if (data && typeof data === "object") return data;
      if (typeof data === "string") {
        try {
          return JSON.parse(data);
        } catch (_) {
          return null;
        }
      }
      return null;
    },

    async touchPresence() {
      const c = this.client();
      if (!c) return;
      const { data } = await c.auth.getSession();
      if (!data.session) return;
      const { error } = await c
        .from("members")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", data.session.user.id);
      if (error && !/last_seen_at/i.test(error.message || "")) {
        console.warn("NSSC: touchPresence failed:", error.message);
      }
    },

    async listMembers() {
      const c = this.client();
      if (!c) return [];
      const withAll = await c
        .from("members")
        .select("id, member_number, name, rank, archetype, token_balance, is_founder, can_post_events, joined_at")
        .order("member_number", { ascending: true });
      if (!withAll.error) return withAll.data || [];
      // If a newer column doesn't exist yet on the project, fall back so the directory still loads.
      if (/rank|archetype|token_balance/i.test(withAll.error.message || "")) {
        const fallback = await c
          .from("members")
          .select("id, member_number, name, is_founder, can_post_events, joined_at")
          .order("member_number", { ascending: true });
        if (fallback.error) throw fallback.error;
        return fallback.data || [];
      }
      throw withAll.error;
    },

    async setMemberRank(id, rank) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c
        .from("members")
        .update({ rank })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /* Legacy setter \u2014 kept for back-compat in case any older flow still calls it. */
    async setMemberFlags(id, flags) {
      let rank = null;
      if (flags.is_founder === true)      rank = "founder";
      else if (flags.can_post_events === true) rank = "tier_3";
      else if (flags.can_post_events === false || flags.is_founder === false) rank = "tier_2";
      if (rank) return this.setMemberRank(id, rank);
    },

    /* Server-authoritative check: can this user post a chat message right now? */
    async canChatNow() {
      const c = this.client();
      if (!c) return true;
      const { data, error } = await c.rpc("can_chat_now");
      if (error) return true; // fail open; insert RLS still enforces the limit
      return Boolean(data);
    },

    /* ---------- Events board ---------- */

    async listDashboardEvents() {
      const c = this.client();
      if (!c) return [];
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await c
        .from("events")
        .select(
          "id, title, description, event_date, location, host_id, created_at, host:members!events_host_id_fkey(member_number, name), attendees:event_attendees(count)"
        )
        .gte("event_date", cutoff)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data || []).map((e) => ({
        ...e,
        attendee_count: e.attendees && e.attendees[0] ? e.attendees[0].count : 0,
      }));
    },

    async getEvent(eventId) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c
        .from("events")
        .select(
          "id, title, description, event_date, location, host_id, created_at, host:members!events_host_id_fkey(member_number, name)"
        )
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },

    async listEventAttendees(eventId) {
      const c = this.client();
      if (!c) return [];
      const { data, error } = await c
        .from("event_attendees")
        .select(
          "event_id, member_id, joined_at, member:members!event_attendees_member_id_fkey(member_number, name, archetype)"
        )
        .eq("event_id", eventId)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async joinEvent(eventId) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const { data, error } = await c
        .from("event_attendees")
        .insert({ event_id: eventId, member_id: uid })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async leaveEvent(eventId) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const { error } = await c
        .from("event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("member_id", uid);
      if (error) throw error;
      return true;
    },

    async isJoinedEvent(eventId) {
      const c = this.client();
      if (!c) return false;
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) return false;
      const { data, error } = await c
        .from("event_attendees")
        .select("event_id")
        .eq("event_id", eventId)
        .eq("member_id", uid)
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },

    async listAllRewardGlyphs() {
      const c = this.client();
      if (!c) return [];
      const { data, error } = await c
        .from("member_reward_glyphs")
        .select("id, member_id, glyph_id, glyph_char, glyph_name, source_event_id, earned_at")
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async listMyRewardGlyphs() {
      const c = this.client();
      if (!c) return [];
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) return [];
      const { data, error } = await c
        .from("member_reward_glyphs")
        .select("id, glyph_id, glyph_char, glyph_name, source_event_id, earned_at")
        .eq("member_id", uid)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async awardEventAttendanceGlyphs(eventId) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const reward =
        (ns.defaultEventRewardGlyph && ns.defaultEventRewardGlyph()) ||
        (ns.rewardGlyphs && ns.rewardGlyphs[0]) ||
        {};
      const { data, error } = await c.rpc("award_event_attendance_glyphs", {
        p_event_id: eventId,
        p_glyph_id: reward.id || "shore_presence",
        p_glyph_char: reward.char || "\u{13080}",
        p_glyph_name: reward.name || "Shore Presence",
      });
      if (error) throw error;
      return data || 0;
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

    /* ---------- Shore Picks (recommendations) ---------- */

    async listShoreRecommendations() {
      const c = this.client();
      if (!c) return [];
      const { data, error } = await c
        .from("shore_recommendations")
        .select(
          "id, category, title, body, location, member_id, created_at, member:members!shore_recommendations_member_id_fkey(member_number, name)"
        )
        .order("created_at", { ascending: false });
      if (error) {
        if (/shore_recommendations/i.test(error.message || "")) return [];
        throw error;
      }
      return data || [];
    },

    async createShoreRecommendation({ category, title, body, location }) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const { data, error } = await c
        .from("shore_recommendations")
        .insert({
          member_id: uid,
          category,
          title: String(title || "").trim(),
          body: body ? String(body).trim() : null,
          location: location ? String(location).trim() : null,
        })
        .select(
          "id, category, title, body, location, member_id, created_at, member:members!shore_recommendations_member_id_fkey(member_number, name)"
        )
        .single();
      if (error) throw error;
      return data;
    },

    async deleteShoreRecommendation(id) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { error } = await c.from("shore_recommendations").delete().eq("id", id);
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

    /* ---------- Reliquary (tallies) ---------- */

    async listTokenLedger(limit) {
      const c = this.client();
      if (!c) return [];
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) return [];
      let q = c
        .from("token_ledger")
        .select("id, delta, kind, note, created_at")
        .eq("member_id", uid)
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) {
        if (/token_ledger/i.test(error.message || "")) return [];
        throw error;
      }
      return data || [];
    },

    async claimDailyTribute() {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c.rpc("claim_daily_tribute");
      if (error) throw error;
      return data;
    },

    async reliquaryGamble(wager) {
      return this.casinoPlay("wheel", wager);
    },

    async casinoPlay(game, wager, choice) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c.rpc("reliquary_casino_play", {
        p_game: game,
        p_wager: wager,
        p_choice: choice || null,
      });
      if (error) throw error;
      return data;
    },

    async reliquaryPurchase(itemId) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c.rpc("reliquary_purchase", { p_item: itemId });
      if (error) throw error;
      return data;
    },

    async listReliquaryRedemptions() {
      const c = this.client();
      if (!c) return [];
      const { data, error } = await c
        .from("reliquary_redemptions")
        .select(
          "id, item_id, item_label, cost, created_at, seen_at, member_id, member:members!reliquary_redemptions_member_id_fkey(member_number, name, email)"
        )
        .order("created_at", { ascending: false });
      if (error) {
        if (/reliquary_redemptions/i.test(error.message || "")) return [];
        throw error;
      }
      return data || [];
    },

    async countUnseenRedemptions() {
      const c = this.client();
      if (!c) return 0;
      const { count, error } = await c
        .from("reliquary_redemptions")
        .select("id", { count: "exact", head: true })
        .is("seen_at", null);
      if (error) {
        if (/reliquary_redemptions/i.test(error.message || "")) return 0;
        return 0;
      }
      return count || 0;
    },

    async markRedemptionSeen(id) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c
        .from("reliquary_redemptions")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /* ---------- Feature requests (changelog inbox) ---------- */

    async submitFeatureRequest(body) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const text = String(body || "").trim();
      if (text.length < 1) throw new Error("Request cannot be empty.");
      if (text.length > 2000) throw new Error("Request is too long (2000 max).");
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const { data, error } = await c
        .from("feature_requests")
        .insert({ member_id: uid, body: text })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async listMyFeatureRequests() {
      const c = this.client();
      if (!c) return [];
      const { data: session } = await c.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) return [];
      const { data, error } = await c
        .from("feature_requests")
        .select("id, body, created_at, seen_at")
        .eq("member_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async listAllFeatureRequests() {
      const c = this.client();
      if (!c) return [];
      const { data, error } = await c
        .from("feature_requests")
        .select(
          "id, body, created_at, seen_at, member_id, member:members!feature_requests_member_id_fkey(member_number, name)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async countUnseenFeatureRequests() {
      const c = this.client();
      if (!c) return 0;
      const { count, error } = await c
        .from("feature_requests")
        .select("id", { count: "exact", head: true })
        .is("seen_at", null);
      if (error) return 0;
      return count || 0;
    },

    async markFeatureRequestSeen(id) {
      const c = this.client();
      if (!c) throw new Error("Supabase not configured.");
      const { data, error } = await c
        .from("feature_requests")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", id)
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
          "id, body, member_id, created_at, member:members!chat_messages_member_id_fkey(member_number, name, is_founder, archetype)"
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
          "id, body, member_id, created_at, member:members!chat_messages_member_id_fkey(member_number, name, is_founder, archetype)"
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
