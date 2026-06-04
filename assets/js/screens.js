/* =========================================================
   NSSC // Screens: render + transition between states.
   ========================================================= */

(function () {
  const ns = (window.NSSC = window.NSSC || {});

  const stage = () => document.getElementById("stage");

  function el(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    return tpl.content.firstChild;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function pickGlyph() {
    return ns.glyphs[Math.floor(Math.random() * ns.glyphs.length)];
  }

  /** Archetype badge image (replaces emoji glyphs). */
  function archetypeImg(arch, opts) {
    if (!arch) return "";
    opts = opts || {};
    const cls = opts.class || "arch-img";
    const src = arch.image || "assets/img/archetypes/" + arch.id + ".png";
    const sizeAttr =
      opts.size != null
        ? ' width="' + opts.size + '" height="' + opts.size + '"'
        : "";
    return (
      '<img class="' +
      cls +
      '" src="' +
      escapeHtml(src) +
      '" alt="' +
      escapeHtml(arch.name) +
      '"' +
      sizeAttr +
      ' loading="lazy" decoding="async" />'
    );
  }

  async function mount(node) {
    const s = stage();
    const existing = s.firstElementChild;
    if (existing) {
      existing.classList.remove("show");
      existing.classList.add("leave");
      await new Promise((r) => setTimeout(r, 380));
      existing.remove();
    }
    s.appendChild(node);
    requestAnimationFrame(() => {
      node.classList.add("show");
    });
  }

  /* ---------- Screen: Landing ---------- */

  ns.renderLanding = async function () {
    const node = el(`
      <section class="screen landing" aria-labelledby="landing-title">
        <img class="logo" src="assets/img/logo.svg" width="400" height="500" alt="NSSC" decoding="async" />
        <h1 id="landing-title" class="glitch">North Shore Social Club</h1>
        <div class="row center">
          <button class="btn" id="begin">Enter</button>
          ${ns.db && ns.db.isConfigured() ? '<button class="btn ghost" id="login">Login</button>' : ""}
        </div>
        <p class="hands">\u{13080} \u{1308C} \u{13153} \u{132F4} \u{1337F}</p>
      </section>
    `);
    await mount(node);

    const blockScroll = (e) => e.preventDefault();
    node.addEventListener("wheel", blockScroll, { passive: false });
    node.addEventListener("touchmove", blockScroll, { passive: false });

    node.querySelector("#begin").addEventListener("click", () => {
      ns.beep(880, 0.06);
      ns.renderWaiver();
    });
    const loginBtn = node.querySelector("#login");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        ns.beep(660, 0.05);
        ns.renderLogin();
      });
    }
  };

  /* ---------- Screen: Login ---------- */

  ns.renderLogin = async function () {
    const node = el(`
      <section class="screen">
        <div class="frame">
          <p class="eyebrow">CHECKPOINT \u00b7 IDENTIFY</p>
          <h1>Member Login</h1>
          <p class="dim">
            Sign in with your member number or email and the password you set
            during induction.
          </p>

          <form id="login-form" novalidate>
            <div class="field">
              <label>Member Number or Email</label>
              <input type="text" id="l-id" autocomplete="username" placeholder="NSSC-0001 or you@somewhere" required />
            </div>
            <div class="field">
              <label>Password</label>
              <input type="password" id="l-pass" autocomplete="current-password" required />
            </div>

            <div class="row between mt-2">
              <button type="button" class="btn ghost" id="back">\u2190 Back</button>
              <button type="submit" class="btn" id="submit">Enter \u2192</button>
            </div>
            <p class="log" id="log">AWAITING CREDENTIALS\u2026</p>
          </form>
        </div>
      </section>
    `);
    await mount(node);

    node.querySelector("#back").addEventListener("click", () => ns.renderLanding());

    node.querySelector("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const log = node.querySelector("#log");
      const submit = node.querySelector("#submit");
      const identifier = node.querySelector("#l-id").value.trim();
      const password = node.querySelector("#l-pass").value;
      if (!identifier || !password) {
        log.innerHTML = '<span class="err">BOTH FIELDS REQUIRED</span>';
        return;
      }
      submit.disabled = true;
      log.innerHTML = "VERIFYING\u2026";
      try {
        await ns.db.signInWithPassword({ identifier, password });
        const me = await ns.db.getMe();
        if (me) {
          ns.storage.saveMember({
            number: me.member_number,
            name: me.name,
            joinedAt: me.joined_at,
          });
        }
        log.innerHTML = '<span class="ok">VERIFIED</span>';
        ns.beep(880, 0.06);
        setTimeout(() => ns.renderDashboard(), 400);
      } catch (err) {
        submit.disabled = false;
        const msg = (err && err.message) || "INVALID CREDENTIALS";
        log.innerHTML = '<span class="err">' + escapeHtml(msg.toUpperCase()) + "</span>";
        ns.beep(140, 0.12, "sawtooth");
      }
    });
  };

  /* ---------- Screen: Waiver ---------- */

  ns.renderWaiver = async function () {
    const clauses = ns.waiver
      .map((c, i) => `<li><span class="muted">${i + 1}.</span> ${escapeHtml(c)}</li>`)
      .join("");
    const node = el(`
      <section class="screen waiver">
        <div class="frame">
          <p class="eyebrow">DOCUMENT 01 \u00b7 WAIVER OF PASSAGE</p>
          <h1>Before You Begin</h1>
          <p class="dim">
            The test that follows is final. There are no retakes, no second draws,
            no quiet reattempts at 3am. Read carefully.
          </p>
          <ol class="clauses">${clauses}</ol>

          <div class="field signature">
            <label for="signer">Choose a Username</label>
            <input id="signer" type="text" autocomplete="username" maxlength="32" placeholder="Sign here\u2026" />
          </div>

          <label class="checkbox">
            <input type="checkbox" id="agree-age" />
            <span>I am <strong>21 years of age or older</strong>.</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" id="agree-1" />
            <span>I have read and accept all clauses above.</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" id="agree-2" />
            <span>I understand the Trial is <strong>one-time</strong>. The archetype it reveals is mine and will not be re-rolled.</span>
          </label>

          <div class="row between mt-2">
            <button class="btn ghost" id="back">\u2190 Reconsider</button>
            <button class="btn" id="begin-test" disabled>Begin Ordeal \u2192</button>
          </div>

          <p class="log" id="log">AWAITING SIGNATURE\u2026</p>
        </div>
      </section>
    `);
    await mount(node);

    const signer = node.querySelector("#signer");
    const aAge = node.querySelector("#agree-age");
    const a1 = node.querySelector("#agree-1");
    const a2 = node.querySelector("#agree-2");
    const go = node.querySelector("#begin-test");
    const log = node.querySelector("#log");

    function refresh() {
      const ok =
        signer.value.trim().length >= 2 &&
        aAge.checked &&
        a1.checked &&
        a2.checked;
      go.disabled = !ok;
      log.innerHTML = ok
        ? '<span class="ok">SIGNATURE ACCEPTED \u00b7 READY</span>'
        : "AWAITING SIGNATURE\u2026";
    }

    [signer, aAge, a1, a2].forEach((n) => n.addEventListener("input", refresh));
    [aAge, a1, a2].forEach((n) => n.addEventListener("change", refresh));
    node.querySelector("#back").addEventListener("click", () => {
      ns.beep(440, 0.05);
      ns.renderLanding();
    });
    go.addEventListener("click", () => {
      if (go.disabled) return;
      ns.beep(880, 0.06);
      ns.session = { signer: signer.value.trim(), index: 0, answers: [] };
      ns.renderQuiz();
    });
  };

  /* ---------- Screen: Quiz (one question at a time) ---------- */

  ns.renderQuiz = async function () {
    const total = ns.config.totalQuestions;
    if (!ns.session) ns.session = { index: 0, answers: [] };
    if (!Array.isArray(ns.session.answers)) ns.session.answers = [];
    const i = ns.session.index;
    const q = ns.questions[i];
    if (!q) {
      ns.session.archetype = ns.scoreArchetype(ns.session.answers);
      return ns.renderArchetype();
    }

    const pips = Array.from({ length: total })
      .map((_, k) => `<span class="pip${k < i ? " done" : ""}"></span>`)
      .join("");

    const answers = q.a
      .map(
        (ans, k) => `
          <button class="answer" data-idx="${k}" data-letter="${escapeHtml(ans.letter || String.fromCharCode(65 + k))}">
            <span class="ans-letter">${escapeHtml(ans.letter || String.fromCharCode(65 + k))}</span>
            <span class="ans-text">${escapeHtml(ans.text)}</span>
          </button>
        `
      )
      .join("");

    const node = el(`
      <section class="screen quiz">
        <div class="frame">
          <div class="meta">
            <span>TRIAL ${ns.roman(i + 1)} / ${ns.roman(total)}</span>
            <span>EVERY ANSWER REVEALS A WORLDVIEW</span>
          </div>
          <div class="progress" aria-hidden="true">${pips}</div>
          <h2 class="muted spread tiny mt-2">Question ${String(i + 1).padStart(2, "0")}</h2>
          <p class="question" id="qtext"></p>
          <div class="answers" id="answers">${answers}</div>
          <p class="log" id="log">AWAITING REFLECTION\u2026</p>
        </div>
      </section>
    `);
    await mount(node);

    await ns.typewriter(node.querySelector("#qtext"), q.q, 14);

    const buttons = node.querySelectorAll(".answer");
    const log = node.querySelector("#log");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const ans = q.a[idx];
        const letter = (ans.letter || String.fromCharCode(65 + idx)).toUpperCase();
        buttons.forEach((b) => (b.disabled = true));
        btn.classList.add("chosen");
        ns.beep(720, 0.06);
        log.innerHTML = '<span class="ok">ACKNOWLEDGED \u00b7 ' + escapeHtml(letter) + "</span>";
        setTimeout(() => {
          ns.session.answers.push(letter);
          ns.session.index += 1;
          ns.renderQuiz();
        }, 540);
      });
    });
  };

  /* ---------- Screen: Archetype Reveal ---------- */

  ns.renderArchetype = async function () {
    const id = (ns.session && ns.session.archetype) || ns.scoreArchetype((ns.session && ns.session.answers) || []);
    const arch = ns.archetypeById(id) || ns.archetypeById("scholar");
    if (ns.session) ns.session.archetype = arch.id;

    const isWizard = arch.id === "wizard";
    const valuesHtml = (arch.values || [])
      .map((v) => "<li>" + escapeHtml(v) + "</li>")
      .join("");

    const node = el(`
      <section class="screen">
        <div class="frame archetype-reveal ${isWizard ? "wizard" : ""}">
          <p class="eyebrow">ARCHETYPE DISCOVERED</p>
          <div class="archetype-glyph" aria-hidden="true">${archetypeImg(arch, { class: "arch-img arch-img-reveal" })}</div>
          <p class="muted spread tiny">YOU ARE</p>
          <h1 class="archetype-name">${escapeHtml(arch.name)}</h1>
          <p class="archetype-tagline">${escapeHtml(arch.tagline)}</p>
          <p class="archetype-desc">${escapeHtml(arch.description)}</p>
          <ul class="archetype-values">${valuesHtml}</ul>
          ${
            isWizard
              ? '<p class="muted tiny spread mt-2">A SECRET WITHIN THE SECRET. THIS ARCHETYPE IS NOT IN ANY BROCHURE.</p>'
              : ""
          }
          <div class="row center mt-2">
            <button class="btn" id="continue">I Am Ready To Listen \u2192</button>
          </div>
        </div>
      </section>
    `);
    await mount(node);

    // Persist archetype to the member row if we're in the post-membership
    // retake flow (the dashboard \u201cDiscover Your Archetype\u201d entry point sets
    // session.classifyOnly).
    if (ns.session && ns.session.classifyOnly && ns.db && ns.db.isConfigured()) {
      try { await ns.db.setMyArchetype(arch.id); } catch (e) { console.warn(e); }
    }

    // Cache locally so the celebration / dashboard can pick it up immediately.
    try {
      const existing = ns.storage.getMember() || {};
      ns.storage.saveMember({ ...existing, archetype: arch.id });
    } catch (_) {}

    ns.beep(isWizard ? 988 : 880, 0.18, "sine");

    node.querySelector("#continue").addEventListener("click", () => {
      ns.beep(880, 0.06);
      if (ns.session && ns.session.classifyOnly) {
        ns.session.classifyOnly = false;
        ns.renderDashboard();
      } else {
        ns.renderRules();
      }
    });
  };

  /* ---------- Screen: Blocked ---------- */

  ns.renderBlocked = async function () {
    ns.storage.block("FAILED_WORTHINESS");
    const ip = (ns.session && ns.session.ip) || "RESOLVING\u2026";
    const redirectUrl = "https://en.wiktionary.org/wiki/unworthy";
    const node = el(`
      <section class="screen">
        <div class="frame blocked">
          <p class="eyebrow" style="color: var(--danger)">RECORD \u00b7 03 \u00b7 EXPULSION</p>
          <h1 class="glitch">You Are Not Worthy.</h1>
          <p>
            Your network signature has been inscribed on the Boreal Blacklist.
            This device, this address, this signal \u2014 all flagged.
          </p>
          <p class="muted">Do not attempt to return. The Order is watching.</p>
          <p class="muted tiny spread">FLAGGED IP \u00b7 <span id="blocked-ip" style="color:var(--danger)">${escapeHtml(ip)}</span></p>
          <div class="stamp">REJECTED</div>
          <p class="log"><span class="err">CONNECTION TERMINATED \u00b7 ${new Date().toUTCString()}</span></p>
          <p class="log"><span class="err">REDIRECTING TO DEFINITION OF YOUR CONDITION IN <span id="redir-count">3</span>\u2026</span></p>
        </div>
      </section>
    `);
    await mount(node);
    if (!(ns.session && ns.session.ip)) {
      ns.fetchIP().then((resolved) => {
        const el2 = node.querySelector("#blocked-ip");
        if (el2) el2.textContent = resolved;
      });
    }
    let remaining = 3;
    const countEl = node.querySelector("#redir-count");
    const tick = setInterval(() => {
      remaining -= 1;
      if (countEl) countEl.textContent = String(Math.max(remaining, 0));
      if (remaining <= 0) {
        clearInterval(tick);
        window.location.href = redirectUrl;
      }
    }, 1000);
  };

  /* ---------- Screen: Rules ---------- */

  ns.renderRules = async function () {
    const items = ns.rules
      .map(
        (r) => `
          <li>
            <div>
              <strong>${escapeHtml(r.title)}</strong>
              <small>${escapeHtml(r.body)}</small>
            </div>
          </li>
        `
      )
      .join("");

    const node = el(`
      <section class="screen">
        <div class="frame">
          <p class="eyebrow">DOCUMENT 02 \u00b7 THE FIVE TENETS</p>
          <h1>You Have Been Seen. Now You Will Listen.</h1>
          <p class="dim">
            Your archetype has been revealed. The Order has heard you. Before you
            are admitted, you will read the tenets and you will accept them. There
            is no negotiation.
          </p>
          <ul class="rules-list">${items}</ul>
          <div class="row between mt-2">
            <span class="muted tiny spread">ONCE A MEMBER \u00b7 ALWAYS A MEMBER</span>
            <button class="btn" id="accept">I Accept The Tenets \u2192</button>
          </div>
        </div>
      </section>
    `);
    await mount(node);
    node.querySelector("#accept").addEventListener("click", () => {
      ns.beep(880, 0.06);
      ns.renderHandshake();
    });
  };

  /* ---------- Screen: Handshake ---------- */

  ns.renderHandshake = async function () {
    const steps = ns.handshake
      .map(
        (s, i) => `
          <li>
            <span class="step">${String(i + 1).padStart(2, "0")}</span>
            <span>${escapeHtml(s)}</span>
          </li>
        `
      )
      .join("");

    const node = el(`
      <section class="screen">
        <div class="frame">
          <p class="eyebrow">DOCUMENT 03 \u00b7 THE GREETING</p>
          <h1>The Handshake</h1>
          <p class="dim">
            Memorise this. Do not write it down outside this portal. This is how
            you recognise your own in the wild \u2014 across pubs, parks, ferry
            terminals, and Albany car parks.
          </p>
          <ul class="handshake-list" id="hsl"></ul>
          <div class="row between mt-2">
            <span class="muted tiny spread">DESTROYS ON CLOSE</span>
            <button class="btn" id="memorised">I Have Memorised It \u2192</button>
          </div>
        </div>
      </section>
    `);
    await mount(node);

    const list = node.querySelector("#hsl");
    list.innerHTML = steps;
    Array.from(list.children).forEach((li, i) => {
      li.style.opacity = "0";
      li.style.transform = "translateX(-6px)";
      li.style.transition = "opacity 280ms ease, transform 280ms ease";
      setTimeout(() => {
        li.style.opacity = "1";
        li.style.transform = "translateX(0)";
        ns.beep(660, 0.03);
      }, 220 * (i + 1));
    });

    node.querySelector("#memorised").addEventListener("click", () => {
      ns.beep(880, 0.06);
      if (ns.db && ns.db.isConfigured()) {
        ns.renderAccountSetup();
      } else {
        ns.renderCelebration();
      }
    });
  };

  /* ---------- Screen: Account Setup ---------- */

  ns.renderAccountSetup = async function () {
    const defaultName = (ns.session && ns.session.signer) || "";
    const node = el(`
      <section class="screen">
        <div class="frame">
          <p class="eyebrow">RECORD \u00b7 04 \u00b7 OPEN DOSSIER</p>
          <h1>Open Your Dossier</h1>
          <p class="dim">
            Your member number will be assigned the moment you submit this form
            \u2014 chronologically, in registration order, starting from
            <span class="kbd">NSSC-0001</span>. Choose your credentials carefully.
            You will use them to log back in.
          </p>

          <form id="acct-form" novalidate>
            <div class="field">
              <label>Member Name</label>
              <input type="text" id="a-name" value="${escapeHtml(defaultName)}" placeholder="Full name" required autocomplete="name" />
            </div>

            <div class="field">
              <label>Email (this is your login)</label>
              <input type="email" id="a-email" autocomplete="email" placeholder="you@somewhere" required />
            </div>

            <div class="tee-grid">
              <div class="field">
                <label>Set Password</label>
                <input type="password" id="a-pass" autocomplete="new-password" placeholder="Min. 8 characters" minlength="8" required />
              </div>
              <div class="field">
                <label>Confirm Password</label>
                <input type="password" id="a-pass2" autocomplete="new-password" placeholder="Repeat" minlength="8" required />
              </div>
            </div>

            <div class="row between mt-2">
              <button type="button" class="btn ghost" id="back">\u2190 Back</button>
              <button type="submit" class="btn" id="submit">Open Dossier \u2192</button>
            </div>
            <p class="log" id="log">AWAITING CREDENTIALS\u2026</p>
          </form>
        </div>
      </section>
    `);
    await mount(node);

    node.querySelector("#back").addEventListener("click", () => ns.renderHandshake());

    node.querySelector("#acct-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const log = node.querySelector("#log");
      const name = node.querySelector("#a-name").value.trim();
      const email = node.querySelector("#a-email").value.trim();
      const pass = node.querySelector("#a-pass").value;
      const pass2 = node.querySelector("#a-pass2").value;
      const submit = node.querySelector("#submit");

      if (!name || !email) {
        log.innerHTML = '<span class="err">NAME AND EMAIL REQUIRED</span>';
        return;
      }
      if (!pass || pass.length < 8) {
        log.innerHTML = '<span class="err">PASSWORD MUST BE 8+ CHARACTERS</span>';
        return;
      }
      if (pass !== pass2) {
        log.innerHTML = '<span class="err">PASSWORDS DO NOT MATCH</span>';
        return;
      }

      submit.disabled = true;
      try {
        log.innerHTML = "INSCRIBING\u2026";
        const user = await ns.db.signUp({ email, password: pass, name });
        log.innerHTML = "ASSIGNING MEMBER NUMBER\u2026";
        const archetype = (ns.session && ns.session.archetype) || null;
        const row = await ns.db.insertMemberRow({ id: user.id, name, email, archetype });
        ns.storage.saveMember({
          number: row.member_number,
          name: row.name,
          joinedAt: row.joined_at,
          archetype: row.archetype || archetype,
        });
        ns.beep(880, 0.06);
        ns.renderCelebration();
      } catch (err) {
        console.error(err);
        submit.disabled = false;
        const msg = (err && err.message) || "REGISTRATION FAILED";
        log.innerHTML = '<span class="err">' + escapeHtml(msg.toUpperCase()) + "</span>";
      }
    });
  };

  /* ---------- Screen: Celebration / Member Number ---------- */

  ns.renderCelebration = async function () {
    let member = ns.storage.getMember();
    if (!member && ns.db && ns.db.isConfigured()) {
      const row = await ns.db.getMe();
      if (row) {
        member = { number: row.member_number, name: row.name, joinedAt: row.joined_at };
        ns.storage.saveMember(member);
      }
    }
    if (!member) {
      member = {
        number: ns.generateMemberNumber(),
        name: ns.session && ns.session.signer,
        joinedAt: new Date().toISOString(),
      };
      ns.storage.saveMember(member);
    }

    const node = el(`
      <section class="screen">
        <div class="frame celebrate">
          <p class="eyebrow">RECORD \u00b7 04 \u00b7 INDUCTION</p>
          <h1 class="glitch">Welcome Home.</h1>
          <p class="dim">
            You are no longer a guest of the North Shore. You are a member of the
            Order. The Club is yours. Conduct yourself accordingly.
          </p>
          <p class="muted spread tiny">ASSIGNED MEMBER NUMBER</p>
          <div class="member-no" id="memno">${escapeHtml(member.number)}</div>
          <p class="sigil">\u{13080} \u{1308C} \u{13153} \u{132F4} \u{1337F}</p>
          <p>
            As a founding rite, the Order grants you one (1) embroidered NSSC tee.
            Claim it below.
          </p>
          <div class="row center">
            <button class="btn" id="claim">Claim My Tee \u2192</button>
          </div>
        </div>
      </section>
    `);
    await mount(node);
    node.querySelector("#claim").addEventListener("click", () => {
      ns.beep(880, 0.06);
      ns.renderTeeForm();
    });
  };

  /* ---------- Screen: Tee Claim Form ---------- */

  ns.renderTeeForm = async function () {
    const member = ns.storage.getMember() || {};
    const sizePills = ns.sizes
      .map((sz) => `<button type="button" class="size-pill" data-size="${sz}">${sz}</button>`)
      .join("");

    const node = el(`
      <section class="screen">
        <div class="frame">
          <p class="eyebrow">DOCUMENT 04 \u00b7 TEE CLAIM</p>
          <h1>Free Embroidered Tee</h1>
          <p class="dim">
            Pick your size, tell us where to send it. The Order will be notified
            the moment you confirm. Allow 2\u20133 weeks for blessing and dispatch.
          </p>

          <form id="tee-form" novalidate>
            <div class="field">
              <label>Member Number</label>
              <input type="text" value="${escapeHtml(member.number || "")}" readonly />
            </div>

            <div class="field">
              <label>Member Name</label>
              <input type="text" id="t-name" value="${escapeHtml(member.name || "")}" placeholder="Full name" required />
            </div>

            <div class="field">
              <label>Size</label>
              <div class="size-group" id="sizes">${sizePills}</div>
              <input type="hidden" id="t-size" required />
            </div>

            <div class="tee-grid">
              <div class="field">
                <label>Street Address</label>
                <input type="text" id="t-street" autocomplete="address-line1" placeholder="123 Lake Rd" required />
              </div>
              <div class="field">
                <label>Suburb</label>
                <input type="text" id="t-suburb" autocomplete="address-level2" placeholder="Devonport" required />
              </div>
              <div class="field">
                <label>City</label>
                <input type="text" id="t-city" autocomplete="address-level2" value="Auckland" required />
              </div>
              <div class="field">
                <label>Postcode</label>
                <input type="text" id="t-postcode" autocomplete="postal-code" placeholder="0624" required />
              </div>
            </div>

            <div class="field">
              <label>Anything Else? (optional)</label>
              <textarea id="t-notes" rows="2" placeholder="Custom embroidery, allergies to nylon, etc."></textarea>
            </div>

            <div class="row between mt-2">
              <button type="button" class="btn ghost" id="back">\u2190 Back</button>
              <button type="submit" class="btn" id="submit">Enter \u00b7 Notify The Order</button>
            </div>
            <p class="log" id="log">AWAITING CLAIM\u2026</p>
          </form>
        </div>
      </section>
    `);
    await mount(node);

    const sizesEl = node.querySelector("#sizes");
    const sizeHidden = node.querySelector("#t-size");
    sizesEl.addEventListener("click", (e) => {
      const t = e.target.closest(".size-pill");
      if (!t) return;
      sizesEl.querySelectorAll(".size-pill").forEach((p) => p.classList.remove("active"));
      t.classList.add("active");
      sizeHidden.value = t.dataset.size;
    });

    node.querySelector("#back").addEventListener("click", () => {
      ns.beep(440, 0.05);
      ns.renderCelebration();
    });

    node.querySelector("#tee-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const log = node.querySelector("#log");
      const data = {
        memberNumber: member.number,
        name: node.querySelector("#t-name").value.trim(),
        size: sizeHidden.value,
        street: node.querySelector("#t-street").value.trim(),
        suburb: node.querySelector("#t-suburb").value.trim(),
        city: node.querySelector("#t-city").value.trim(),
        postcode: node.querySelector("#t-postcode").value.trim(),
        notes: node.querySelector("#t-notes").value.trim(),
        submittedAt: new Date().toISOString(),
      };

      const missing = ["name", "size", "street", "suburb", "city", "postcode"]
        .filter((k) => !data[k]);
      if (missing.length) {
        log.innerHTML = '<span class="err">MISSING: ' + missing.join(", ").toUpperCase() + "</span>";
        return;
      }

      const submitBtn = node.querySelector("#submit");
      submitBtn.disabled = true;

      log.innerHTML = "TRANSMITTING TO THE ORDER\u2026";
      ns.beep(880, 0.06);

      if (ns.db && ns.db.isConfigured()) {
        // Persist the claim straight into the members table. Founders and
        // admins will see it in the Orders modal on the dashboard, so there
        // is no need for an email/webhook side-channel.
        try {
          const c = ns.db.client();
          const { error } = await c
            .from("members")
            .update({
              tee_claimed: true,
              tee_size: data.size,
              tee_address: {
                street: data.street,
                suburb: data.suburb,
                city: data.city,
                postcode: data.postcode,
                notes: data.notes,
              },
              tee_claimed_at: new Date().toISOString(),
              tee_seen_at: null,
            })
            .eq("member_number", data.memberNumber);
          if (error) throw error;
          log.innerHTML = '<span class="ok">CLAIM RECEIVED BY THE ORDER</span>';
        } catch (err) {
          console.warn("Tee claim write failed:", err);
          log.innerHTML = '<span class="err">CLAIM FAILED \u00b7 ' + escapeHtml((err.message || "TRY AGAIN").toUpperCase()) + "</span>";
          submitBtn.disabled = false;
          return;
        }
        setTimeout(() => ns.renderFinal(data), 700);
        return;
      }

      // Legacy local-only fallback (no Supabase configured): fire the
      // webhook / mailto so the order still reaches the founder.
      const ok = await ns.deliverOrder(data);
      if (ok === "endpoint") {
        log.innerHTML = '<span class="ok">RECEIVED \u00b7 THE ORDER HAS BEEN NOTIFIED</span>';
        setTimeout(() => ns.renderFinal(data), 900);
      } else if (ok === "mailto") {
        log.innerHTML = '<span class="ok">DRAFT OPENED \u00b7 SEND TO COMPLETE CLAIM</span>';
        setTimeout(() => ns.renderFinal(data), 600);
      } else {
        log.innerHTML = '<span class="ok">CLAIM RECORDED</span>';
        setTimeout(() => ns.renderFinal(data), 600);
      }
    });
  };

  /* ---------- Screen: Final ---------- */

  ns.renderFinal = async function (data) {
    const member = ns.storage.getMember() || {};
    const hasDb = ns.db && ns.db.isConfigured();
    const node = el(`
      <section class="screen">
        <div class="frame final">
          <p class="seal">\u{13080} \u{1308C} \u{13153}</p>
          <h1>It Is Done.</h1>
          <p>
            ${escapeHtml(member.name || data.name || "Initiate")}, your tee will
            arrive in 2\u20133 weeks. Wear it with discretion.
          </p>
          <p class="muted">
            Until then, walk the Shore knowing you are no longer alone in it.
          </p>
          <div class="member-no">${escapeHtml(member.number || "")}</div>
          <p class="tiny muted spread">ORDO \u00b7 BOREALIS \u00b7 MMXXVI</p>
          ${hasDb ? '<div class="row center mt-2"><button class="btn" id="go-dash">Enter The Dashboard \u2192</button></div>' : '<p class="hands">\u{13080} \u{1308C} \u{13153} \u{132F4} \u{1337F}</p>'}
        </div>
      </section>
    `);
    await mount(node);
    if (hasDb) {
      node.querySelector("#go-dash").addEventListener("click", () => {
        ns.beep(880, 0.06);
        ns.renderDashboard();
      });
    }
  };

  /* ---------- Screen: Dashboard ---------- */

  function formatEventDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-NZ", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (_) {
      return iso;
    }
  }

  function formatChatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });
    } catch (_) {
      return "";
    }
  }

  ns.renderDashboard = async function () {
    const node = el(`
      <section class="screen dashboard">
        <div class="dash-head">
          <div>
            <p class="eyebrow">MEMBER DASHBOARD</p>
            <h1 id="dash-welcome">Welcome.</h1>
          </div>
          <div class="row">
            <button class="btn ghost" id="orders-btn" style="display:none">
              Orders <span class="badge" id="orders-badge" style="display:none">0</span>
            </button>
            <span class="archetype-pill" id="me-archetype" style="display:none">
              <span class="archetype-pill-glyph" id="me-archetype-glyph"></span>
              <span class="archetype-pill-name"  id="me-archetype-name">\u2014</span>
            </span>
            <span class="kbd" id="me-role">MEMBER</span>
            <button class="btn ghost" id="logout">Logout</button>
          </div>
        </div>

        <nav class="dash-tabs" id="dash-tabs" role="tablist">
          <button class="dash-tab is-active" type="button" data-tab="chat"    role="tab">Chat</button>
          <button class="dash-tab"           type="button" data-tab="events"  role="tab">Meetups</button>
          <button class="dash-tab"           type="button" data-tab="members" role="tab">Members</button>
        </nav>

        <div class="dash-grid three">
          <div class="frame dash-col chat-col is-active" data-pane="chat">
            <div class="row between">
              <h2 class="mb-0">World Chat</h2>
              <span class="tiny muted" id="chat-policy">RESETS DAILY \u00b7 04:00 NZ</span>
            </div>
            <ul class="chat-list" id="chat"></ul>
            <p class="chat-throttle tiny muted" id="chat-throttle" style="display:none"></p>
            <form class="chat-form" id="chat-form">
              <input id="chat-input" type="text" maxlength="500" placeholder="Say something to the Shore\u2026" autocomplete="off" required />
              <button class="btn" type="submit" id="chat-send">Send</button>
            </form>
          </div>

          <div class="frame dash-col" data-pane="events">
            <div class="row between">
              <h2 class="mb-0">Upcoming Meetups</h2>
              <button class="btn ghost" id="new-event" style="display:none">+ New Event</button>
            </div>
            <p class="dim tiny" id="events-empty" style="display:none">
              Nothing scheduled. The Shore is quiet.
            </p>
            <ul class="event-list" id="events"></ul>
          </div>

          <div class="frame dash-col" data-pane="members">
            <div class="row between">
              <h2 class="mb-0">Members</h2>
              <span class="tiny muted" id="members-count">\u2014</span>
            </div>
            <ul class="member-list" id="members"></ul>
          </div>
        </div>

        <p class="log" id="log">CONNECTED</p>
      </section>
    `);
    await mount(node);

    const log = node.querySelector("#log");

    let me;
    try {
      me = await ns.db.getMe();
    } catch (e) {
      console.error(e);
    }
    if (!me) {
      log.innerHTML = '<span class="err">NOT SIGNED IN</span>';
      setTimeout(() => ns.renderLogin(), 400);
      return;
    }

    node.querySelector("#dash-welcome").textContent =
      "Welcome back, " + (me.name || "Member") + ".";

    const myRank = me.rank || (me.is_founder ? "founder" : me.can_post_events ? "tier_3" : "tier_1");
    const isFounder = myRank === "founder";
    const isAdmin = ns.rankAtLeast(myRank, "admin");
    const canPostEvents = ns.rankAtLeast(myRank, "tier_3");
    const canChatFreely = ns.rankAtLeast(myRank, "tier_2");

    node.querySelector("#me-role").textContent =
      ns.rankShort(myRank) + " \u00b7 " + me.member_number;

    // Archetype badge \u2014 visible only if the member has been classified.
    const archPill = node.querySelector("#me-archetype");
    if (me.archetype) {
      const arch = ns.archetypeById(me.archetype);
      if (arch) {
        archPill.style.display = "";
        archPill.classList.toggle("wizard", arch.id === "wizard");
        archPill.title = arch.name + " \u00b7 " + arch.tagline;
        node.querySelector("#me-archetype-glyph").innerHTML = archetypeImg(arch, {
          class: "arch-img arch-img-pill",
          size: 22,
        });
        node.querySelector("#me-archetype-name").textContent = arch.name.replace(/^The\s+/i, "").toUpperCase();
      }
    } else if (ns.db && ns.db.isConfigured()) {
      // Legacy member (predates the Trial). Offer a one-time classification.
      archPill.style.display = "";
      archPill.classList.add("unset");
      archPill.style.cursor = "pointer";
      node.querySelector("#me-archetype-glyph").innerHTML = "";
      node.querySelector("#me-archetype-name").textContent = "DISCOVER";
      archPill.addEventListener("click", () => {
        if (!confirm("Take the Trial now to reveal your archetype? This can only be done once.")) return;
        ns.session = { signer: me.name, index: 0, answers: [], classifyOnly: true };
        ns.renderQuiz();
      });
    }

    /* --- cleanup hook: unsubscribe realtime when leaving --- */
    let unsubscribeChat = null;
    const cleanup = () => { try { unsubscribeChat && unsubscribeChat(); } catch (_) {} };
    node.addEventListener("DOMNodeRemoved", cleanup, { once: true });

    node.querySelector("#logout").addEventListener("click", async () => {
      cleanup();
      await ns.db.signOut();
      ns.storage.clearMember();
      ns.renderLanding();
    });

    /* --- mobile tab switching (one pane visible at a time) --- */
    const tabs = node.querySelectorAll(".dash-tab");
    const panes = node.querySelectorAll("[data-pane]");
    const activateTab = (name) => {
      tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
      panes.forEach((p) => p.classList.toggle("is-active", p.dataset.pane === name));
      // Re-anchor chat to the bottom when it becomes visible.
      if (name === "chat") {
        const chatUl = node.querySelector("#chat");
        if (chatUl) chatUl.scrollTop = chatUl.scrollHeight;
      }
    };
    tabs.forEach((t) =>
      t.addEventListener("click", () => {
        ns.beep(660, 0.03);
        activateTab(t.dataset.tab);
      })
    );

    const newEventBtn = node.querySelector("#new-event");
    if (canPostEvents) {
      newEventBtn.style.display = "";
      newEventBtn.addEventListener("click", () => {
        cleanup();
        ns.renderCreateEvent();
      });
    }

    /* --- admin / founder: orders button + badge --- */
    if (isAdmin) {
      const ordersBtn = node.querySelector("#orders-btn");
      ordersBtn.style.display = "";
      ordersBtn.addEventListener("click", () => ns.openOrdersModal(node));
      try {
        const unseen = await ns.db.countUnseenOrders();
        const badge = node.querySelector("#orders-badge");
        if (unseen > 0) {
          badge.style.display = "";
          badge.textContent = String(unseen);
          ordersBtn.classList.add("has-new");
        }
      } catch (_) { /* non-fatal */ }
    }

    /* --- events --- */
    try {
      const events = await ns.db.listUpcomingEvents();
      const ul = node.querySelector("#events");
      const empty = node.querySelector("#events-empty");
      if (!events.length) {
        empty.style.display = "";
      } else {
        ul.innerHTML = events
          .map((e) => {
            const canDelete = isFounder || e.host_id === me.id;
            return `
              <li data-id="${escapeHtml(e.id)}">
                <div class="ev-when">
                  <div class="ev-date">${escapeHtml(formatEventDate(e.event_date))}</div>
                  ${e.location ? `<div class="ev-loc">${escapeHtml(e.location)}</div>` : ""}
                </div>
                <div class="ev-main">
                  <div class="ev-title">${escapeHtml(e.title)}</div>
                  ${e.description ? `<div class="ev-desc">${escapeHtml(e.description)}</div>` : ""}
                  <div class="ev-host">${escapeHtml(e.host?.name || "\u2014")}</div>
                </div>
                ${canDelete ? '<button class="btn ghost ev-del" data-id="' + escapeHtml(e.id) + '">delete</button>' : ""}
              </li>
            `;
          })
          .join("");

        ul.addEventListener("click", async (ev) => {
          const t = ev.target.closest(".ev-del");
          if (!t) return;
          if (!confirm("Cancel this meetup?")) return;
          try {
            await ns.db.deleteEvent(t.dataset.id);
            t.closest("li").remove();
            if (!ul.children.length) empty.style.display = "";
          } catch (err) {
            alert(err.message || "Failed to cancel event.");
          }
        });
      }
    } catch (err) {
      console.error(err);
      log.innerHTML = '<span class="err">EVENTS UNAVAILABLE</span>';
    }

    /* --- members --- */
    try {
      const members = await ns.db.listMembers();
      const ul = node.querySelector("#members");
      const countEl = node.querySelector("#members-count");
      countEl.textContent = members.length + " \u00b7 active";

      const rankOptions = ns.ranks
        .map((r) => '<option value="' + r.id + '">' + escapeHtml(r.label) + "</option>")
        .join("");

      ul.innerHTML = members
        .map((m) => {
          const isMe = m.id === me.id;
          const memberRank = m.rank || (m.is_founder ? "founder" : m.can_post_events ? "tier_3" : "tier_1");
          const tag = ns.rankShort(memberRank);
          const tagClass =
            memberRank === "founder" ? "rank-founder"
            : memberRank === "admin" ? "rank-admin"
            : memberRank === "tier_3" ? "rank-t3"
            : memberRank === "tier_2" ? "rank-t2"
            : "rank-t1";
          const arch = m.archetype ? ns.archetypeById(m.archetype) : null;
          const archGlyph = arch
            ? '<span class="mem-arch ' + (arch.id === "wizard" ? "wizard" : "") + '" title="' + escapeHtml(arch.name) + '">' + archetypeImg(arch, { class: "arch-img arch-img-mem", size: 20 }) + "</span>"
            : '<span class="mem-arch unset" title="No archetype">\u00b7</span>';
          // Only founders can change ranks, and not their own.
          const showPicker = isFounder && !isMe;
          const picker = showPicker
            ? `<select class="rank-pick" data-id="${escapeHtml(m.id)}" data-current="${escapeHtml(memberRank)}">${rankOptions}</select>`
            : "";
          return `
            <li${isMe ? ' class="me"' : ""}>
              <div class="mem-head">
                <span class="mem-no">${escapeHtml(m.member_number || "?")}</span>
                <span class="mem-tag ${tagClass}">${escapeHtml(tag)}</span>
              </div>
              <div class="mem-body">
                ${archGlyph}
                <span class="mem-name" title="${escapeHtml(m.name || "")}">${escapeHtml(m.name || "")}${isMe ? ' <span class="muted tiny">(you)</span>' : ""}</span>
                ${picker}
              </div>
            </li>
          `;
        })
        .join("");

      // Initialise <select> values to each member's current rank.
      ul.querySelectorAll(".rank-pick").forEach((sel) => {
        sel.value = sel.dataset.current;
      });

      ul.addEventListener("change", async (ev) => {
        const sel = ev.target.closest(".rank-pick");
        if (!sel) return;
        const id = sel.dataset.id;
        const next = sel.value;
        const prev = sel.dataset.current;
        if (next === prev) return;
        const label = ns.rankLabel(next);
        if (!confirm("Set this member to " + label + "?")) {
          sel.value = prev;
          return;
        }
        sel.disabled = true;
        try {
          await ns.db.setMemberRank(id, next);
          cleanup();
          ns.renderDashboard();
        } catch (err) {
          sel.disabled = false;
          sel.value = prev;
          alert(err.message || "Couldn't change rank.");
        }
      });
    } catch (err) {
      console.error(err);
      const ul = node.querySelector("#members");
      const countEl = node.querySelector("#members-count");
      if (countEl) countEl.textContent = "ERROR";
      if (ul) {
        ul.innerHTML =
          '<li class="muted tiny" style="border-color:var(--danger);color:var(--danger)">' +
          "DIRECTORY UNAVAILABLE \u00b7 " +
          escapeHtml(err.message || String(err)) +
          "</li>";
      }
    }

    /* --- world chat --- */
    const chatUl = node.querySelector("#chat");
    const renderChatMessage = (m, opts) => {
      const mine = m.member_id === me.id;
      const founder = m.member?.is_founder;
      const canDel = mine || me.is_founder;
      const arch = m.member?.archetype ? ns.archetypeById(m.member.archetype) : null;
      const archHtml = arch
        ? '<span class="chat-arch ' + (arch.id === "wizard" ? "wizard" : "") + '" title="' + escapeHtml(arch.name) + '">' + archetypeImg(arch, { class: "arch-img arch-img-chat", size: 16 }) + "</span>"
        : "";
      const li = document.createElement("li");
      li.dataset.id = m.id;
      if (mine) li.classList.add("mine");
      if (founder) li.classList.add("founder");
      li.innerHTML = `
        <div class="chat-meta">
          ${archHtml}
          <span class="chat-author">${escapeHtml(m.member?.name || "?")}</span>
          <span class="chat-no muted">${escapeHtml(m.member?.member_number || "")}</span>
          <span class="chat-time muted tiny">${escapeHtml(formatChatTime(m.created_at))}</span>
          ${canDel ? '<button class="chat-del" title="delete" data-del="' + escapeHtml(m.id) + '">\u00d7</button>' : ""}
        </div>
        <div class="chat-body">${escapeHtml(m.body)}</div>
      `;
      if (opts && opts.prepend) chatUl.prepend(li);
      else chatUl.appendChild(li);
      chatUl.scrollTop = chatUl.scrollHeight;
      return li;
    };

    let myLastChatAt = null;
    try {
      const recent = await ns.db.listChatMessages(200);
      recent.forEach((m) => {
        renderChatMessage(m);
        if (m.member_id === me.id) {
          if (!myLastChatAt || new Date(m.created_at) > new Date(myLastChatAt)) {
            myLastChatAt = m.created_at;
          }
        }
      });
    } catch (err) {
      console.error(err);
    }

    chatUl.addEventListener("click", async (ev) => {
      const t = ev.target.closest("[data-del]");
      if (!t) return;
      try {
        await ns.db.deleteChatMessage(t.dataset.del);
        const li = t.closest("li");
        if (li) li.remove();
      } catch (err) {
        alert(err.message || "Couldn't delete message.");
      }
    });

    const chatForm = node.querySelector("#chat-form");
    const chatInput = node.querySelector("#chat-input");
    const chatSend = node.querySelector("#chat-send");
    const chatPolicy = node.querySelector("#chat-policy");
    const chatThrottle = node.querySelector("#chat-throttle");

    function applyChatThrottleUI() {
      if (canChatFreely) return;
      // tier_1: one message per 24h.
      chatPolicy.textContent = "TIER 1 \u00b7 1 MESSAGE / 24H";
      if (myLastChatAt) {
        const next = new Date(new Date(myLastChatAt).getTime() + 24 * 3600 * 1000);
        const now = new Date();
        if (next > now) {
          const diff = next - now;
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          chatInput.disabled = true;
          chatSend.disabled = true;
          chatInput.placeholder = "Your message has been received.";
          chatThrottle.style.display = "";
          chatThrottle.innerHTML = "DAILY LIMIT REACHED \u00b7 NEXT MESSAGE IN " +
            '<span class="ok">' + h + "H " + (m < 10 ? "0" + m : m) + "M</span>";
          return;
        }
      }
      chatInput.disabled = false;
      chatSend.disabled = false;
      chatThrottle.style.display = "none";
      chatInput.placeholder = "Speak. You get one for the day.";
    }
    applyChatThrottleUI();
    if (!canChatFreely) {
      // Re-render countdown every minute.
      const throttleTick = setInterval(applyChatThrottleUI, 60000);
      node.addEventListener("DOMNodeRemoved", () => clearInterval(throttleTick), { once: true });
    }

    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = chatInput.value.trim();
      if (!body) return;
      chatSend.disabled = true;
      try {
        // For tier_1, double-check server-side eligibility just before sending.
        if (!canChatFreely) {
          const ok = await ns.db.canChatNow();
          if (!ok) {
            myLastChatAt = myLastChatAt || new Date().toISOString();
            applyChatThrottleUI();
            return;
          }
        }
        await ns.db.postChatMessage(body);
        chatInput.value = "";
        if (!canChatFreely) {
          myLastChatAt = new Date().toISOString();
          applyChatThrottleUI();
        }
      } catch (err) {
        alert(err.message || "Couldn't send.");
      } finally {
        if (canChatFreely || !chatInput.disabled) chatSend.disabled = false;
        if (!chatInput.disabled) chatInput.focus();
      }
    });

    /* --- realtime chat updates --- */
    unsubscribeChat = ns.db.subscribeChat({
      onInsert: async (row) => {
        if (chatUl.querySelector('[data-id="' + row.id + '"]')) return;
        // Inserted rows from realtime don't include the embedded member; hydrate it.
        let member = null;
        try {
          const c = ns.db.client();
          const { data } = await c
            .from("members")
            .select("member_number, name, is_founder, rank, archetype")
            .eq("id", row.member_id)
            .single();
          member = data;
        } catch (_) {}
        renderChatMessage({ ...row, member });
        if (row.member_id !== me.id) ns.beep(880, 0.04);
        if (row.member_id === me.id && !canChatFreely) {
          myLastChatAt = row.created_at;
          applyChatThrottleUI();
        }
      },
      onDelete: (row) => {
        const li = chatUl.querySelector('[data-id="' + row.id + '"]');
        if (li) li.remove();
      },
    });
  };

  /* ---------- Modal: Tee Orders (founders) ---------- */

  ns.openOrdersModal = async function (dashNode) {
    const modal = el(`
      <div class="modal-back" id="orders-modal">
        <div class="modal frame">
          <div class="row between">
            <div>
              <p class="eyebrow">FOUNDER \u00b7 TEE ORDERS</p>
              <h2 class="mb-0">Embroidered Tee Claims</h2>
            </div>
            <button class="btn ghost modal-close" aria-label="Close">\u00d7</button>
          </div>
          <p class="dim tiny mt-2" id="orders-empty" style="display:none">
            No tees have been claimed yet.
          </p>
          <ul class="orders-list" id="orders-list"></ul>
          <p class="log" id="orders-log">LOADING\u2026</p>
        </div>
      </div>
    `);
    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
      // Refresh dashboard badge after closing
      const badge = dashNode && dashNode.querySelector("#orders-badge");
      const btn = dashNode && dashNode.querySelector("#orders-btn");
      if (badge && btn) {
        ns.db.countUnseenOrders().then((n) => {
          if (n > 0) {
            badge.style.display = "";
            badge.textContent = String(n);
            btn.classList.add("has-new");
          } else {
            badge.style.display = "none";
            btn.classList.remove("has-new");
          }
        });
      }
    };
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest(".modal-close")) close();
    });
    document.addEventListener("keydown", function escClose(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", escClose);
      }
    });

    const ul = modal.querySelector("#orders-list");
    const empty = modal.querySelector("#orders-empty");
    const log = modal.querySelector("#orders-log");

    let orders = [];
    try {
      orders = await ns.db.listTeeOrders();
    } catch (err) {
      log.innerHTML = '<span class="err">' + escapeHtml(err.message || "FAILED") + "</span>";
      return;
    }
    if (!orders.length) {
      empty.style.display = "";
      log.textContent = "0 orders";
      return;
    }

    const renderRow = (o) => {
      const addr = o.tee_address || {};
      const unseen = !o.tee_seen_at;
      return `
        <li${unseen ? ' class="new"' : ""} data-id="${escapeHtml(o.id)}">
          <div class="ord-head">
            <span class="mem-no">${escapeHtml(o.member_number || "")}</span>
            <span class="ord-name">${escapeHtml(o.name || "")}</span>
            <span class="ord-size">SIZE ${escapeHtml(o.tee_size || "?")}</span>
            ${unseen ? '<span class="ord-tag">NEW</span>' : '<span class="ord-tag seen">SEEN</span>'}
          </div>
          <div class="ord-body">
            <div class="ord-addr">
              ${escapeHtml(addr.street || "")}<br>
              ${escapeHtml(addr.suburb || "")}, ${escapeHtml(addr.city || "")} ${escapeHtml(addr.postcode || "")}
            </div>
            ${addr.notes ? '<div class="ord-notes muted">' + escapeHtml(addr.notes) + "</div>" : ""}
            <div class="ord-meta muted tiny">
              ${escapeHtml(o.email || "")} \u00b7 claimed ${escapeHtml(o.tee_claimed_at ? new Date(o.tee_claimed_at).toLocaleString("en-NZ") : "\u2014")}
            </div>
            ${
              unseen
                ? '<button class="btn ghost ord-ack" data-id="' + escapeHtml(o.id) + '">Mark Acknowledged</button>'
                : ""
            }
          </div>
        </li>
      `;
    };

    ul.innerHTML = orders.map(renderRow).join("");
    log.textContent = orders.length + " total \u00b7 " + orders.filter((o) => !o.tee_seen_at).length + " new";

    ul.addEventListener("click", async (ev) => {
      const t = ev.target.closest(".ord-ack");
      if (!t) return;
      t.disabled = true;
      try {
        await ns.db.markTeeSeen(t.dataset.id);
        const li = t.closest("li");
        li.classList.remove("new");
        li.querySelector(".ord-tag").outerHTML = '<span class="ord-tag seen">SEEN</span>';
        t.remove();
        const remaining = ul.querySelectorAll("li.new").length;
        log.textContent = orders.length + " total \u00b7 " + remaining + " new";
      } catch (err) {
        t.disabled = false;
        alert(err.message || "Couldn't acknowledge.");
      }
    });
  };

  /* ---------- Screen: Create Event ---------- */

  ns.renderCreateEvent = async function () {
    const node = el(`
      <section class="screen">
        <div class="frame">
          <p class="eyebrow">NEW \u00b7 MEETUP</p>
          <h1>Host A Meetup</h1>
          <p class="dim">
            Members will see this on the dashboard. Keep it Shore-flavoured.
          </p>

          <form id="ev-form" novalidate>
            <div class="field">
              <label>Title</label>
              <input type="text" id="e-title" placeholder="Sunday surf at Long Bay" required />
            </div>
            <div class="tee-grid">
              <div class="field">
                <label>Date &amp; Time</label>
                <input type="datetime-local" id="e-date" required />
              </div>
              <div class="field">
                <label>Location</label>
                <input type="text" id="e-loc" placeholder="Long Bay Regional Park" />
              </div>
            </div>
            <div class="field">
              <label>Description (optional)</label>
              <textarea id="e-desc" rows="3" placeholder="What's the plan?"></textarea>
            </div>

            <div class="row between mt-2">
              <button type="button" class="btn ghost" id="back">\u2190 Back</button>
              <button type="submit" class="btn" id="submit">Post Meetup \u2192</button>
            </div>
            <p class="log" id="log">READY</p>
          </form>
        </div>
      </section>
    `);
    await mount(node);

    node.querySelector("#back").addEventListener("click", () => ns.renderDashboard());

    node.querySelector("#ev-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const log = node.querySelector("#log");
      const submit = node.querySelector("#submit");
      const title = node.querySelector("#e-title").value.trim();
      const dateStr = node.querySelector("#e-date").value;
      const location = node.querySelector("#e-loc").value.trim();
      const description = node.querySelector("#e-desc").value.trim();
      if (!title || !dateStr) {
        log.innerHTML = '<span class="err">TITLE AND DATE REQUIRED</span>';
        return;
      }
      submit.disabled = true;
      try {
        await ns.db.createEvent({
          title,
          description,
          eventDate: new Date(dateStr).toISOString(),
          location,
        });
        log.innerHTML = '<span class="ok">POSTED</span>';
        ns.beep(880, 0.06);
        setTimeout(() => ns.renderDashboard(), 400);
      } catch (err) {
        submit.disabled = false;
        log.innerHTML = '<span class="err">' + escapeHtml((err.message || "FAILED").toUpperCase()) + "</span>";
      }
    });
  };

  /* ---------- Order delivery (Formspree/Web3Forms or mailto fallback) ---------- */

  ns.deliverOrder = async function (data) {
    const endpoint = (ns.config.notifyEndpoint || "").trim();
    if (endpoint) {
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            subject: `NSSC \u00b7 New Tee Claim \u00b7 ${data.memberNumber}`,
            ...data,
          }),
        });
        if (r.ok) return "endpoint";
      } catch (_) {
        /* fall through to mailto */
      }
    }

    const subject = encodeURIComponent(
      `NSSC \u00b7 New Tee Claim \u00b7 ${data.memberNumber}`
    );
    const body = encodeURIComponent(
      [
        "New NSSC member tee claim:",
        "",
        `Member: ${data.memberNumber}`,
        `Name:   ${data.name}`,
        `Email:  ${data.email}`,
        `Size:   ${data.size}`,
        "",
        "Ship to:",
        `  ${data.street}`,
        `  ${data.suburb}, ${data.city} ${data.postcode}`,
        "",
        `Notes:  ${data.notes || "(none)"}`,
        "",
        `Submitted: ${data.submittedAt}`,
      ].join("\n")
    );
    const href = `mailto:${ns.config.notifyEmail}?subject=${subject}&body=${body}`;
    try {
      window.location.href = href;
      return "mailto";
    } catch (_) {
      return false;
    }
  };
})();
