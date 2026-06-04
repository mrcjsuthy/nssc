/* =========================================================
   NSSC // Effects: digital rain, ambient glyphs/numbers, HUD,
   typewriter helper, audio "beep" stub.
   ========================================================= */

(function () {
  const ns = (window.NSSC = window.NSSC || {});

  /* ---------- Digital rain (matrix-style) ----------
     Slow, low-opacity, monochrome neon. CRT vibe. */
  function startMatrix() {
    const canvas = document.getElementById("matrix");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let cols = 0;
    let drops = [];
    const chars =
      "01アァカサタナハマヤャラワガザダバパNSSCMMXXVI" +
      "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#@*+<>{}[]";

    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontSize = 14;
      cols = Math.floor(window.innerWidth / fontSize);
      drops = new Array(cols)
        .fill(0)
        .map(() => Math.random() * (window.innerHeight / fontSize));
      ctx.font = `${fontSize}px JetBrains Mono, monospace`;
    }

    function frame() {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = "#39ff14";
      const fontSize = 14;
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillText(ch, x, y);
        if (y > window.innerHeight && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.5;
      }
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      requestAnimationFrame(frame);
    }
  }

  /* ---------- Ambient floating layers (numerology + glyphs) ---------- */

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function spawn(layer, text, opts) {
    const span = document.createElement("span");
    span.textContent = text;
    const left = rand(2, 96);
    const top = rand(60, 100);
    const dur = rand(opts.minDur, opts.maxDur);
    const delay = rand(0, 4);
    const size = rand(opts.minSize, opts.maxSize);
    span.style.left = left + "%";
    span.style.top = top + "%";
    span.style.fontSize = size + "px";
    span.style.animationDuration = dur + "s";
    span.style.animationDelay = delay + "s";
    layer.appendChild(span);
    setTimeout(() => span.remove(), (dur + delay) * 1000 + 200);
  }

  function startAmbient() {
    const numLayer = document.getElementById("numerology");
    const glyphLayer = document.getElementById("glyphs");
    if (!numLayer || !glyphLayer) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setInterval(() => {
      const t = ns.numerologyTokens[
        Math.floor(Math.random() * ns.numerologyTokens.length)
      ];
      spawn(numLayer, t, { minDur: 14, maxDur: 26, minSize: 9, maxSize: 13 });
    }, 900);

    setInterval(() => {
      const g = ns.glyphs[Math.floor(Math.random() * ns.glyphs.length)];
      spawn(glyphLayer, g, { minDur: 22, maxDur: 38, minSize: 22, maxSize: 42 });
    }, 1400);
  }

  /* ---------- IP lookup (best-effort, multiple fallbacks) ---------- */

  ns.fetchIP = async function () {
    if (ns.session && ns.session.ip) return ns.session.ip;
    const endpoints = [
      { url: "https://api.ipify.org?format=json", field: "ip" },
      { url: "https://api64.ipify.org?format=json", field: "ip" },
      { url: "https://ipapi.co/json/", field: "ip" },
    ];
    for (const e of endpoints) {
      try {
        const r = await fetch(e.url, { cache: "no-store" });
        if (!r.ok) continue;
        const j = await r.json();
        const ip = j && j[e.field];
        if (ip) {
          ns.session = Object.assign({}, ns.session, { ip });
          document.dispatchEvent(new CustomEvent("nssc:ip", { detail: { ip } }));
          return ip;
        }
      } catch (_) {
        /* try next */
      }
    }
    ns.session = Object.assign({}, ns.session, { ip: "MASKED" });
    document.dispatchEvent(new CustomEvent("nssc:ip", { detail: { ip: "MASKED" } }));
    return "MASKED";
  };

  /* ---------- HUD ticker ---------- */

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function startHUD() {
    const uptimeEl = document.getElementById("hud-uptime");
    const seedEl = document.getElementById("hud-seed");
    const statusEl = document.getElementById("hud-status");
    const coordEl = document.getElementById("hud-coord");
    const start = Date.now();

    const statuses = [
      "SECURE LINK ESTABLISHED",
      "TRACE: ACTIVE",
      "FIREWALL: ACTIVE",
      "ENCRYPTION: AES-256",
      "LISTENER: 7\u00b07\u00b07",
      "CONSCIENCE: SCANNING",
    ];

    if (coordEl) coordEl.textContent = "IP \u00b7 RESOLVING\u2026";
    ns.fetchIP().then((ip) => {
      if (coordEl) coordEl.textContent = "IP \u00b7 " + ip;
    });

    function seed() {
      const hex = "0123456789ABCDEF";
      let s = "";
      for (let i = 0; i < 8; i++) s += hex[Math.floor(Math.random() * 16)];
      return s;
    }

    if (seedEl) seedEl.textContent = "SEED " + seed();
    setInterval(() => {
      if (seedEl) seedEl.textContent = "SEED " + seed();
    }, 1800);

    setInterval(() => {
      if (statusEl) {
        statusEl.textContent =
          statuses[Math.floor(Math.random() * statuses.length)];
      }
    }, 4200);

    setInterval(() => {
      if (!uptimeEl) return;
      const sec = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      uptimeEl.textContent = `UPTIME ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    }, 1000);
  }

  /* ---------- Typewriter ---------- */

  ns.typewriter = function (el, text, speed) {
    return new Promise((resolve) => {
      speed = speed || 18;
      el.textContent = "";
      el.classList.add("caret");
      let i = 0;
      const tick = () => {
        if (i >= text.length) {
          el.classList.remove("caret");
          return resolve();
        }
        el.textContent += text.charAt(i++);
        setTimeout(tick, speed);
      };
      tick();
    });
  };

  /* ---------- Tiny beep ---------- */

  ns.beep = function (freq, dur, type) {
    try {
      if (!ns._ac) ns._ac = new (window.AudioContext || window.webkitAudioContext)();
      const ac = ns._ac;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || "square";
      o.frequency.value = freq || 660;
      g.gain.value = 0.02;
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + (dur || 0.05));
    } catch (_) {
      /* audio blocked, no-op */
    }
  };

  ns.startEffects = function () {
    startMatrix();
    startAmbient();
    startHUD();
  };
})();
