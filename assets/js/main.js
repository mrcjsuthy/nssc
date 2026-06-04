/* =========================================================
   NSSC // Main: boot + route based on stored state.
   ========================================================= */

(function () {
  const ns = window.NSSC;

  async function boot() {
    ns.startEffects();

    if (ns.storage.isBlocked()) {
      ns.renderBlocked();
      return;
    }

    if (ns.db && ns.db.isConfigured()) {
      try {
        const session = await ns.db.getSession();
        if (session) {
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
    location.reload();
  };
  ns.unblock = function () {
    ns.storage.unblock();
    location.reload();
  };
})();
