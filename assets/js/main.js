/* =========================================================
   NSSC // Main: boot + route based on stored state.
   ========================================================= */

(function () {
  const ns = window.NSSC;

  async function boot() {
    ns.startEffects();

    // Clear any leftover "blocked" flag from the old (worthiness-fail) flow.
    // The Trial no longer fails anyone, so this key is dead state.
    try { ns.storage.unblock(); } catch (_) {}

    if (ns.db && ns.db.isConfigured()) {
      try {
        const session = await ns.db.getSession();
        if (session) {
          void ns.db.touchPresence?.();
          const me = await ns.db.getMe();
          if (me && !me.tee_claimed) {
            ns.renderLanding();
            return;
          }
          ns.renderDashboard();
          return;
        }
      } catch (e) {
        console.warn("Supabase session check failed:", e);
      }
      ns.renderLanding();
      return;
    }

    const member = ns.storage.getMember();
    if (member) {
      ns.renderCelebration();
      return;
    }

    ns.renderLanding();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!ns.db || !ns.db.isConfigured()) return;
    void ns.db.refreshSessionIfNeeded?.();
  });

  /* ---------- Dev helpers (browser console) ----------
     Type into devtools:
       NSSC.reset()          - wipe block + membership and reload
       NSSC.unblock()        - lift the blacklist, keep membership
  */
  ns.reset = async function () {
    if (ns.db && ns.db.isConfigured()) {
      try { await ns.db.signOut(); } catch (_) {}
    }
    ns.storage.unblock();
    ns.storage.clearMember();
    ns.storage.clearRemember();
    location.reload();
  };
  ns.unblock = function () {
    ns.storage.unblock();
    location.reload();
  };
})();
