# NSSC // North Shore Social Club

A single-page, no-build "portal" for the North Shore Social Club. Dark,
retro-terminal aesthetic with neon-green thin highlights, ambient numerology,
and ancient hieroglyphs. Hosted on GitHub Pages, backed by Supabase for
auth + members + events.

---

## The experience

1. **Landing.** Monogram in the centre. Two buttons: **Test Worthiness** (new
   recruits) or **Member Login**.
2. **Waiver.** Six clauses. Sign by typing a name, tick two boxes.
3. **Ordeal.** Ten morality questions. Three answers each. Exactly one is
   correct.
   - Get them all right → you advance.
   - Get any one wrong → device + browser is added to the "Boreal Blacklist"
     (and the flagged IP shown back at them on the rejection screen).
4. **The Five Tenets.** Read and accept the rules of the Club.
5. **The Handshake.** Memorise the four-step left-fist greeting.
6. **Open Your Dossier.** Pick an email + password — this becomes your login.
7. **Induction.** Member number assigned chronologically from `NSSC-0001`
   onwards. Member 0001 is automatically a founder.
8. **Free Tee Claim.** Pick a size, enter an address, hit **Enter**. The Order
   gets notified.
9. **Member Dashboard.** Members directory + upcoming meetups. Approved members
   can post events; founders can approve other members.

All onboarding happens in a single page — no reloads — until the very end.

---

## File layout

```
nssc/
├── index.html              # The whole portal lives here
├── .nojekyll               # GitHub Pages: serve assets/ untouched
├── README.md
├── supabase/
│   ├── SETUP.md            # 5-minute Supabase setup guide
│   └── schema.sql          # DB schema + RLS + triggers (run once)
└── assets/
    ├── css/styles.css      # Dark terminal/CRT/neon theme
    ├── img/logo.svg        # NSSC monogram (vectorised)
    └── js/
        ├── data.js         # Questions, rules, handshake, config (Supabase URL/key)
        ├── effects.js      # Matrix rain, glyphs, HUD, typewriter, beeps, IP lookup
        ├── storage.js      # localStorage state (block + cached member)
        ├── db.js           # Supabase client wrapper (auth, members, events)
        ├── screens.js      # Renders each screen, handles flow
        └── main.js         # Boot + routing based on session + stored state
```

---

## Deploy

### 1. Supabase (5 minutes, free tier)

Follow [`supabase/SETUP.md`](./supabase/SETUP.md) — create a project, paste
the contents of `supabase/schema.sql` into the SQL editor, copy your project
URL + anon key into `assets/js/data.js`.

This is what gives you chronological member numbers, auth, the members
directory, the events board, and the founder approval workflow. **Without
it, the portal still runs as a local-only demo** (no login, members number
is fake-random, dashboard hidden).

### 2. GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Source:** `Deploy from a branch`.
3. Pick branch `main`, folder `/ (root)`. Save.
4. Wait ~30s. Your site is live at `https://<you>.github.io/<repo>/`.

For a custom domain (e.g. `northshore.club`):

1. Add a `CNAME` file at the repo root containing just your domain.
2. Point your DNS A/AAAA records at GitHub Pages
   ([docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)).

The `.nojekyll` file is already included so the `assets/` directory is served
verbatim.

---

## Getting notified when someone claims a tee

Two options. **Option B works out of the box.**

### Option A — webhook (recommended)

Pick any "form-to-email" provider that accepts a JSON `POST` and gives you a
URL. Free tiers exist on:

- [Formspree](https://formspree.io/)
- [Web3Forms](https://web3forms.com/)
- [Formspark](https://formspark.io/)
- [Basin](https://usebasin.com/)
- A [Zapier](https://zapier.com/) / [Make](https://make.com/) webhook
- Your own server

Open `assets/js/data.js` and paste the URL:

```js
window.NSSC.config = {
  notifyEndpoint: "https://formspree.io/f/yourFormId",
  notifyEmail: "you@northshore.club",
  // ...
};
```

You'll receive a JSON payload with:

```json
{
  "subject": "NSSC · New Tee Claim · NSSC-4821",
  "memberNumber": "NSSC-4821",
  "name": "Jane Doe",
  "email": "jane@…",
  "size": "M",
  "street": "12 Lake Rd",
  "suburb": "Devonport",
  "city": "Auckland",
  "postcode": "0624",
  "notes": "…",
  "submittedAt": "2026-…"
}
```

### Option B — `mailto:` fallback (zero setup)

If `notifyEndpoint` is empty (the default), the form opens the user's email
client pre-filled with a draft to whatever address is in `notifyEmail`. They
hit **Send**, you get the order.

Edit the email in `assets/js/data.js`:

```js
notifyEmail: "orders@yourdomain.com",
```

---

## Customise

Everything content-related lives in `assets/js/data.js`:

- `questions` — swap, reorder, or add. The flow auto-resizes.
  Set `config.totalQuestions` if you want a different cutoff.
- `rules` — the Five Tenets. Title + body each.
- `handshake` — the steps shown one-by-one with a stagger.
- `waiver` — the clauses on the consent page.
- `sizes` — available tee sizes.

Theme colours live in CSS variables at the top of `assets/css/styles.css`:

```css
--bg:       #000000;
--neon:     #39ff14;
--ink:      #c8ffd0;
--danger:   #ff3b3b;
```

The SVG sigil is hand-tweakable in `assets/img/logo.svg`.

---

## Dev helpers

Open the browser console on the page and run:

```js
NSSC.reset();     // wipe blocklist + sign out + clear cached member, then reload
NSSC.unblock();   // lift the blacklist, keep everything else
```

To completely reset the **server-side** state so member numbers restart at
`NSSC-0001`, run the SQL snippet at the bottom of [`supabase/SETUP.md`](./supabase/SETUP.md).

> **Important caveat:** the "IP block" is a flavour-text `localStorage` flag —
> it blocks the *browser*, not the *IP*. Static sites can't actually block
> network traffic. If you want a true IP block, you'd need to put this behind
> Cloudflare Workers or a small backend that records IPs. For the spirit of
> the site, the localStorage flag is enough — most users won't think to clear
> it, and the dramatic copy carries the rest.

---

## Run locally

It's pure HTML/CSS/JS, so any static server works:

```bash
# Python 3
python3 -m http.server 8000

# Or, with Node
npx serve .
```

Then visit `http://localhost:8000/`.

---

## Browser support

Modern evergreen browsers (Chrome, Safari, Firefox, Edge). Mobile-friendly.
Respects `prefers-reduced-motion` and disables the matrix rain + flicker for
users who have asked for less motion.

---

*Ordo · Borealis · MMXXVI*
