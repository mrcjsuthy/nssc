# NSSC // Supabase Setup

One-time setup. Takes ~5 minutes. Free tier is more than enough.

---

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**.
3. Name it `nssc`. Pick a strong DB password (you won't need to type it again — it's stored in Supabase). Region: **Sydney (ap-southeast-2)** is closest to Auckland.
4. Wait ~1 minute for provisioning.

## 2. Run the schema

1. In the Supabase dashboard for your new project: **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this repo, copy the entire contents into the editor.
3. Click **Run**. You should see `Success. No rows returned.`

> **Re-run this file any time `schema.sql` changes in the repo.** It's
> idempotent — `if not exists` / `add column if not exists` everywhere — so
> running it again on an existing project applies migrations without losing
> data.

This creates:

- `members` table with a chronological `member_number` (auto-assigned as `NSSC-0001`, `NSSC-0002`, …) and tee-order tracking columns.
- `events` table.
- `chat_messages` table for the world chat (24-hour rolling retention; physically purged daily by `pg_cron`).
- Row-Level Security so members can read everything, but only **founders** can promote others and only **approved members** can create events.
- An auto-promotion rule: **whoever is member 0001 is automatically a founder with event-posting rights.** That's you.
- Realtime publication for `chat_messages` so the chat updates live.

## 3. Grab your project credentials

In the Supabase dashboard: **Project Settings → API** (left sidebar, gear icon).

Copy two values:

- **Project URL** — something like `https://abcd1234.supabase.co`
- **`anon` `public` API key** — the long `eyJ...` string in the **"Project API keys"** section. *(NOT the `service_role` key — never paste that into the frontend.)*

Paste them into `assets/js/data.js`:

```js
window.NSSC.config = {
  supabaseUrl: "https://abcd1234.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJI…",
  // … rest of the config
};
```

That's it — commit, push, and your portal is live.

## 4. Confirm email is *off* (so signup is instant)

Default Supabase requires email confirmation before login. For a private club portal you almost certainly don't want this — members complete the trial, set a password, and should land in the dashboard immediately.

- **Authentication → Providers → Email** in the dashboard.
- Toggle **"Confirm email"** OFF.
- Save.

(If you'd rather keep email confirmation on, leave it — members will just need to click a link before they can log back in later.)

## 5. Test the flow

1. Open your portal.
2. Hit **Test Worthiness**, run the ordeal, accept the tenets, learn the handshake.
3. At the tee-claim step you'll set a password.
4. On submission you become member **NSSC-0001**, the founding member. You're automatically a founder and can post events.
5. Reload the page → you should land on the **Member Dashboard**.

Subsequent members will be `NSSC-0002`, `0003`, etc. (in registration order). They won't be able to post events until *you* approve them from the dashboard.

---

## Reset everything (during testing)

If you want to wipe the database and start the numbering from `NSSC-0001` again, run this in the Supabase SQL editor:

```sql
-- Delete all data
delete from public.events;
delete from public.members;
delete from auth.users;

-- Reset the chronological counter
alter sequence member_number_seq restart with 1;
```

Then `NSSC.reset()` in the browser console to clear your local session.

---

## Costs

Supabase free tier includes:

- 500 MB Postgres
- 50,000 monthly active users
- 5 GB egress
- 1 GB file storage

You will never hit these limits for a North Shore social club. If you somehow do, the next tier is $25 USD/month.

---

## Security notes

- The `anon` key is **safe to commit and ship in client code**. It only grants the access defined by your Row-Level Security policies.
- The `service_role` key is **never** put in the frontend. Keep it secret.
- Founders can only be granted via the dashboard UI (and you, NSSC-0001, are the only initial founder). Members cannot self-promote.
- Members can read the full directory (names + member numbers). If you want to hide email addresses from the directory, drop email from the SELECT in the frontend — RLS already protects against an attacker scraping more than what you SELECT.
