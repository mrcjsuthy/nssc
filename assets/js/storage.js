/* =========================================================
   NSSC // Storage: local persistence for block + membership.
   ========================================================= */

(function () {
  const ns = (window.NSSC = window.NSSC || {});
  const cfg = ns.config;

  function safeGet(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (_) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  ns.storage = {
    isBlocked() {
      return Boolean(safeGet(cfg.blockKey));
    },
    block(reason) {
      safeSet(cfg.blockKey, {
        at: new Date().toISOString(),
        reason: reason || "FAILED_WORTHINESS",
      });
    },
    unblock() {
      try {
        localStorage.removeItem(cfg.blockKey);
      } catch (_) {}
    },
    getMember() {
      return safeGet(cfg.memberKey);
    },
    saveMember(member) {
      return safeSet(cfg.memberKey, member);
    },
    clearMember() {
      try {
        localStorage.removeItem(cfg.memberKey);
      } catch (_) {}
    },
  };

  ns.generateMemberNumber = function () {
    const n = Math.floor(Math.random() * 9000) + 1000;
    return "NSSC-" + n;
  };

  ns.roman = function (num) {
    const map = [
      ["M", 1000], ["CM", 900], ["D", 500], ["CD", 400],
      ["C", 100], ["XC", 90], ["L", 50], ["XL", 40],
      ["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1],
    ];
    let r = "";
    for (const [s, v] of map) {
      while (num >= v) {
        r += s;
        num -= v;
      }
    }
    return r;
  };
})();
