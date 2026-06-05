-- =========================================================
-- NSSC // Supabase schema
-- Run this in the Supabase SQL editor for a new project, or to upgrade
-- an existing one. Idempotent: safe to re-run; preserves existing data.
-- =========================================================

-- ---------- Member numbering sequence ----------
create sequence if not exists member_number_seq start 1;

-- ---------- Rank enum (ordered low → high) ----------
-- Privileges are inherited upward:
--   tier_1  : can observe + chat once per 24 hours
--   tier_2  : can chat freely
--   tier_3  : can host meetups
--   admin   : can manage tee orders
--   founder : god tier; can edit ranks
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_rank') then
    create type public.member_rank as enum
      ('tier_1', 'tier_2', 'tier_3', 'admin', 'founder');
  end if;
end
$$;

-- ---------- members table ----------
create table if not exists public.members (
  id              uuid primary key references auth.users(id) on delete cascade,
  member_number   text unique,
  name            text not null,
  email           text unique not null,
  is_founder      boolean not null default false,    -- LEGACY, see below
  can_post_events boolean not null default false,    -- LEGACY, see below
  joined_at       timestamptz not null default now(),
  tee_claimed     boolean not null default false,
  tee_size        text,
  tee_address     jsonb,
  notes           text
);

-- Tee order tracking (added in later migration; safe to re-run)
alter table public.members add column if not exists tee_claimed_at timestamptz;
alter table public.members add column if not exists tee_seen_at    timestamptz;

-- Rank column (added in later migration; safe to re-run)
alter table public.members add column if not exists rank public.member_rank;

-- Archetype column \u2014 builder / scholar / guardian / explorer / sovereign / wizard.
-- Nullable: legacy members predating the archetype trial start out as null
-- until they retake the Trial.
alter table public.members add column if not exists archetype text;

-- Presence heartbeat for HUD "online" count (updated by the client while signed in).
alter table public.members add column if not exists last_seen_at timestamptz;

-- Reliquary tallies (shop currency) + daily earn cooldown.
alter table public.members add column if not exists token_balance integer not null default 0;
alter table public.members alter column token_balance set default 100;
alter table public.members add column if not exists last_tribute_at timestamptz;

-- Backfill rank from legacy boolean flags (only for rows where rank is still null)
update public.members
  set rank = case
    when is_founder      then 'founder'::public.member_rank
    when can_post_events then 'tier_3'::public.member_rank
    else                      'tier_1'::public.member_rank
  end
  where rank is null;

-- Now make rank required + default
alter table public.members
  alter column rank set default 'tier_1',
  alter column rank set not null;

create index if not exists members_member_number_idx on public.members(member_number);
create index if not exists members_joined_at_idx     on public.members(joined_at);
create index if not exists members_tee_claimed_idx   on public.members(tee_claimed) where tee_claimed = true;
create index if not exists members_rank_idx          on public.members(rank);

-- ---------- events table ----------
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  event_date    timestamptz not null,
  location      text,
  host_id       uuid not null references public.members(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists events_event_date_idx on public.events(event_date);

-- ---------- event_attendees (RSVP / join meetups) ----------
create table if not exists public.event_attendees (
  event_id    uuid not null references public.events(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (event_id, member_id)
);

create index if not exists event_attendees_event_idx on public.event_attendees(event_id);
create index if not exists event_attendees_member_idx on public.event_attendees(member_id);

-- ---------- member_reward_glyphs (attendance rewards, profile collection) ----------
create table if not exists public.member_reward_glyphs (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.members(id) on delete cascade,
  glyph_id        text not null,
  glyph_char      text not null,
  glyph_name      text not null,
  source_event_id uuid references public.events(id) on delete set null,
  earned_at       timestamptz not null default now(),
  unique (member_id, source_event_id)
);

create index if not exists member_reward_glyphs_member_idx on public.member_reward_glyphs(member_id);
create index if not exists member_reward_glyphs_event_idx  on public.member_reward_glyphs(source_event_id);

-- ---------- chat_messages table (world chat, daily-reset) ----------
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  body        text not null check (char_length(body) between 1 and 500),
  member_id   uuid not null references public.members(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists chat_messages_created_idx on public.chat_messages(created_at desc);

-- ---------- feature_requests (member suggestions, founder inbox) ----------
create table if not exists public.feature_requests (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  seen_at     timestamptz
);

create index if not exists feature_requests_created_idx on public.feature_requests(created_at desc);
create index if not exists feature_requests_unseen_idx on public.feature_requests(seen_at)
  where seen_at is null;

-- ---------- shore_recommendations (member picks around the Shore) ----------
create table if not exists public.shore_recommendations (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  category    text not null check (category in ('food', 'activity', 'date', 'other')),
  title       text not null check (char_length(title) between 1 and 120),
  body        text check (body is null or char_length(body) <= 500),
  location    text check (location is null or char_length(location) <= 120),
  created_at  timestamptz not null default now()
);

create index if not exists shore_recommendations_created_idx
  on public.shore_recommendations(created_at desc);
create index if not exists shore_recommendations_category_idx
  on public.shore_recommendations(category);

-- ---------- Trigger: chronological member numbers + founder for #0001 ----------
create or replace function public.assign_member_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_num int;
begin
  if new.member_number is null then
    next_num := nextval('public.member_number_seq');
    new.member_number := 'NSSC-' || lpad(next_num::text, 4, '0');
    if next_num = 1 then
      new.rank := 'founder'::public.member_rank;
    else
      -- Force the default on insert; clients cannot self-grant a higher rank.
      new.rank := 'tier_1'::public.member_rank;
    end if;
  end if;
  -- New members start with 100 tallies (signup bonus).
  if new.token_balance is null or new.token_balance = 0 then
    new.token_balance := 100;
  end if;
  -- Keep legacy boolean columns in sync with rank so older code keeps working.
  new.is_founder      := (new.rank = 'founder'::public.member_rank);
  new.can_post_events := (new.rank >= 'tier_3'::public.member_rank);
  return new;
end;
$$;

drop trigger if exists trg_assign_member_number on public.members;
create trigger trg_assign_member_number
  before insert on public.members
  for each row execute function public.assign_member_number();

-- Trigger to keep legacy boolean flags in sync when rank is updated.
create or replace function public.sync_legacy_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_founder      := (new.rank = 'founder'::public.member_rank);
  new.can_post_events := (new.rank >= 'tier_3'::public.member_rank);
  return new;
end;
$$;

drop trigger if exists trg_sync_legacy_flags on public.members;
create trigger trg_sync_legacy_flags
  before update of rank on public.members
  for each row execute function public.sync_legacy_flags();

-- ---------- Rank helpers ----------
create or replace function public.my_rank()
returns public.member_rank
language sql
stable
security definer
set search_path = ''
as $$
  select rank from public.members where id = auth.uid();
$$;

create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_rank() = 'founder'::public.member_rank, false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_rank() >= 'admin'::public.member_rank, false);
$$;

create or replace function public.can_post_events()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_rank() >= 'tier_3'::public.member_rank, false);
$$;

create or replace function public.can_chat_freely()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_rank() >= 'tier_2'::public.member_rank, false);
$$;

-- For client UI: tells a tier_1 member whether they may post a chat
-- message right now (or have to wait until 24h have passed since their
-- last one).
create or replace function public.can_chat_now()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_chat_freely()
    or not exists (
      select 1 from public.chat_messages
      where member_id = auth.uid()
        and created_at > (now() - interval '24 hours')
    );
$$;

grant execute on function public.my_rank()         to authenticated;
grant execute on function public.is_founder()      to authenticated;
grant execute on function public.is_admin()        to authenticated;
grant execute on function public.can_post_events() to authenticated;
grant execute on function public.can_chat_freely() to authenticated;
grant execute on function public.can_chat_now()    to authenticated;

-- Anon-callable: resolve a member number to its account email so users can
-- log in with "0001" instead of remembering the email they signed up with.
-- This is safe because member numbers are already public inside the club
-- (you can see them in the dashboard directory) and emails are not used
-- for any authorisation \u2014 only the password gates the account.
create or replace function public.email_for_member_number(p_member_number text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select email from public.members where member_number = p_member_number;
$$;

grant execute on function public.email_for_member_number(text) to anon, authenticated;

-- Anon-callable aggregate for the HUD (total members + recently active).
create or replace function public.member_hud_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total',  (select count(*)::int from public.members),
    'online', (select count(*)::int from public.members
               where last_seen_at > (now() - interval '5 minutes'))
  );
$$;

grant execute on function public.member_hud_stats() to anon, authenticated;

-- Award attendance glyphs to everyone who joined a finished meetup (founders only).
create or replace function public.award_event_attendance_glyphs(
  p_event_id uuid,
  p_glyph_id text default 'shore_presence',
  p_glyph_char text default '',
  p_glyph_name text default 'Shore Presence'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  att record;
  n int := 0;
  r int;
begin
  if not public.is_founder() then
    raise exception 'Founders only';
  end if;

  select * into ev from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found';
  end if;
  if ev.event_date > now() then
    raise exception 'Meetup has not finished yet';
  end if;

  for att in
    select ea.member_id
    from public.event_attendees ea
    where ea.event_id = p_event_id
  loop
    insert into public.member_reward_glyphs (
      member_id, glyph_id, glyph_char, glyph_name, source_event_id
    )
    values (att.member_id, p_glyph_id, p_glyph_char, p_glyph_name, p_event_id)
    on conflict (member_id, source_event_id) do nothing;
    get diagnostics r = row_count;
    n := n + r;
  end loop;

  return n;
end;
$$;

grant execute on function public.award_event_attendance_glyphs(uuid, text, text, text) to authenticated;

-- ---------- token_ledger (Reliquary transaction history) ----------
create table if not exists public.token_ledger (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  delta       integer not null,
  kind        text not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists token_ledger_member_idx on public.token_ledger(member_id, created_at desc);

-- ---------- reliquary_redemptions (founder inbox for IRL fulfillment) ----------
create table if not exists public.reliquary_redemptions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  item_id     text not null,
  item_label  text not null,
  cost        integer not null,
  created_at  timestamptz not null default now(),
  seen_at     timestamptz
);

create index if not exists reliquary_redemptions_created_idx
  on public.reliquary_redemptions(created_at desc);
create index if not exists reliquary_redemptions_unseen_idx
  on public.reliquary_redemptions(seen_at) where seen_at is null;

-- Claim +10 tallies once per 24h.
create or replace function public.claim_daily_tribute()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  bal int;
  last_ts timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select token_balance, last_tribute_at
    into bal, last_ts
  from public.members
  where id = auth.uid();

  if last_ts is not null and last_ts > (now() - interval '24 hours') then
    raise exception 'Tribute already claimed. Return tomorrow.';
  end if;

  update public.members
    set token_balance = token_balance + 10,
        last_tribute_at = now()
  where id = auth.uid()
  returning token_balance into bal;

  insert into public.token_ledger (member_id, delta, kind, note)
  values (auth.uid(), 10, 'tribute', 'Daily tribute');

  return json_build_object('balance', bal);
end;
$$;

-- Casino games in The Pit (~5% house edge). Server-authoritative outcomes.
create or replace function public.reliquary_casino_play(
  p_game text,
  p_wager integer,
  p_choice text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  bal int;
  new_bal int;
  net int := 0;
  won boolean := false;
  detail text := '';
  landed text;
  roll int;
  player int;
  dealer int;
  r float;
  sym_a int;
  sym_b int;
  sym_c int;
  symbols text[] := array['7','$','*','+','=','#'];
  game_label text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_wager < 1 or p_wager > 500 then
    raise exception 'Wager must be between 1 and 500';
  end if;

  select token_balance into bal from public.members where id = auth.uid();
  if bal < p_wager then
    raise exception 'Insufficient tallies';
  end if;

  game_label := initcap(replace(lower(trim(p_game)), '_', ' '));

  case lower(trim(p_game))
    when 'wheel' then
      won := random() < 0.475;
      net := case when won then p_wager else -p_wager end;
      detail := case when won then 'Wheel aligns — double' else 'Wheel fades' end;

    when 'coin' then
      if lower(trim(p_choice)) not in ('heads', 'tails') then
        raise exception 'Pick heads or tails';
      end if;
      landed := case when random() < 0.5 then 'heads' else 'tails' end;
      won := landed = lower(trim(p_choice)) and random() < 0.95;
      net := case when won then p_wager else -p_wager end;
      detail := 'Landed ' || landed;

    when 'dice' then
      if lower(trim(p_choice)) not in ('high', 'low') then
        raise exception 'Pick high or low';
      end if;
      roll := 1 + floor(random() * 6)::int;
      won := (lower(trim(p_choice)) = 'high' and roll >= 4)
          or (lower(trim(p_choice)) = 'low' and roll <= 3);
      net := case when won then floor(p_wager * 0.9) else -p_wager end;
      detail := 'Rolled ' || roll;

    when 'blackjack' then
      player := 16 + floor(random() * 6)::int;
      dealer := 16 + floor(random() * 6)::int;
      if player > dealer then
        won := true;
        net := p_wager;
      elsif player < dealer then
        net := -p_wager;
      elsif random() < 0.55 then
        net := -p_wager;
      else
        net := 0;
        detail := 'Push';
      end if;
      detail := coalesce(nullif(detail, ''), 'You ' || player || ' · House ' || dealer);

    when 'poker', 'showdown' then
      player := 2 + floor(random() * 13)::int;
      dealer := 2 + floor(random() * 13)::int;
      if player > dealer then
        won := true;
        net := floor(p_wager * 0.9);
      else
        net := -p_wager;
      end if;
      detail := 'You ' || player || ' · House ' || dealer;

    when 'slots' then
      r := random();
      if r < 0.03 then
        won := true;
        net := p_wager * 4;
        sym_a := floor(random() * 6)::int;
        sym_b := sym_a;
        sym_c := sym_a;
        detail := 'JACKPOT [' || symbols[sym_a + 1] || '|' || symbols[sym_b + 1] || '|' || symbols[sym_c + 1] || ']';
      elsif r < 0.43 then
        won := true;
        net := p_wager;
        sym_a := floor(random() * 6)::int;
        sym_b := sym_a;
        sym_c := floor(random() * 6)::int;
        if sym_c = sym_a then
          sym_c := (sym_a + 1 + floor(random() * 5)::int) % 6;
        end if;
        detail := 'Match [' || symbols[sym_a + 1] || '|' || symbols[sym_b + 1] || '|' || symbols[sym_c + 1] || ']';
      else
        net := -p_wager;
        sym_a := floor(random() * 6)::int;
        sym_b := floor(random() * 6)::int;
        sym_c := floor(random() * 6)::int;
        detail := '[' || symbols[sym_a + 1] || '|' || symbols[sym_b + 1] || '|' || symbols[sym_c + 1] || ']';
      end if;

    else
      raise exception 'Unknown game';
  end case;

  update public.members
    set token_balance = token_balance + net
  where id = auth.uid()
  returning token_balance into new_bal;

  if net <> 0 then
    insert into public.token_ledger (member_id, delta, kind, note)
    values (
      auth.uid(),
      net,
      case when net > 0 then 'casino_win' else 'casino_loss' end,
      game_label || ' · ' || detail
    );
  end if;

  return json_build_object(
    'balance', new_bal,
    'net', net,
    'won', won,
    'game', lower(trim(p_game)),
    'detail', detail,
    'wager', p_wager
  );
end;
$$;

-- Legacy wheel RPC (delegates to casino).
create or replace function public.reliquary_gamble(p_wager integer default 1)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.reliquary_casino_play('wheel', p_wager, null);
end;
$$;

-- Spend tallies on real-world redemptions (fulfilled manually by the Order).
create or replace function public.reliquary_purchase(p_item text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cost int;
  label text;
  bal int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  case p_item
    when 'enamel_pin'    then cost := 2000;  label := 'Enamel Pin';
    when 'hat'           then cost := 5000;  label := 'Hat';
    when 'hyoketsu_apple' then cost := 10000; label := 'Box of Hyoketsu Apple';
    when 'bbq'           then cost := 15000; label := 'BBQ';
    when 'pokemon_cards' then cost := 20000; label := 'Pack of Pokemon Cards';
    when 'prezzy_card'   then cost := 50000; label := '$100 Prezzy Card';
    else raise exception 'Unknown relic';
  end case;

  select token_balance into bal from public.members where id = auth.uid();
  if bal < cost then
    raise exception 'Insufficient tallies';
  end if;

  update public.members
    set token_balance = token_balance - cost
  where id = auth.uid()
  returning token_balance into bal;

  insert into public.token_ledger (member_id, delta, kind, note)
  values (auth.uid(), -cost, 'purchase', label);

  insert into public.reliquary_redemptions (member_id, item_id, item_label, cost)
  values (auth.uid(), p_item, label, cost);

  return json_build_object('balance', bal, 'item', p_item, 'label', label);
end;
$$;

grant execute on function public.claim_daily_tribute() to authenticated;
grant execute on function public.reliquary_casino_play(text, integer, text) to authenticated;
grant execute on function public.reliquary_gamble(integer) to authenticated;
grant execute on function public.reliquary_purchase(text) to authenticated;

-- ---------- Row-Level Security ----------
alter table public.members              enable row level security;
alter table public.events               enable row level security;
alter table public.event_attendees      enable row level security;
alter table public.member_reward_glyphs enable row level security;
alter table public.chat_messages        enable row level security;
alter table public.feature_requests     enable row level security;
alter table public.shore_recommendations enable row level security;
alter table public.reliquary_redemptions enable row level security;
alter table public.token_ledger         enable row level security;

-- Drop existing policies idempotently
drop policy if exists "members: read all"                on public.members;
drop policy if exists "members: insert self"             on public.members;
drop policy if exists "members: self update profile"     on public.members;
drop policy if exists "members: founders update anyone"  on public.members;

drop policy if exists "events: read all"                 on public.events;
drop policy if exists "events: insert if approved"       on public.events;
drop policy if exists "events: host update own"          on public.events;
drop policy if exists "events: host or founder delete"   on public.events;

drop policy if exists "event_attendees: read all"        on public.event_attendees;
drop policy if exists "event_attendees: join self"       on public.event_attendees;
drop policy if exists "event_attendees: leave self"      on public.event_attendees;

drop policy if exists "reward_glyphs: read all"          on public.member_reward_glyphs;
drop policy if exists "reward_glyphs: founder insert"    on public.member_reward_glyphs;

drop policy if exists "chat: read recent"                on public.chat_messages;
drop policy if exists "chat: insert as self"             on public.chat_messages;
drop policy if exists "chat: delete own or founder"      on public.chat_messages;

drop policy if exists "feature_requests: insert self"        on public.feature_requests;
drop policy if exists "feature_requests: read own or founder" on public.feature_requests;
drop policy if exists "feature_requests: founder mark seen"  on public.feature_requests;

drop policy if exists "token_ledger: read own" on public.token_ledger;

drop policy if exists "shore_recs: read all" on public.shore_recommendations;
drop policy if exists "shore_recs: insert self" on public.shore_recommendations;
drop policy if exists "shore_recs: delete own or founder" on public.shore_recommendations;

drop policy if exists "reliquary_redemptions: founder read" on public.reliquary_redemptions;
drop policy if exists "reliquary_redemptions: founder mark seen" on public.reliquary_redemptions;

-- ---- members policies ----

-- Everyone signed in can read the directory.
create policy "members: read all"
  on public.members for select
  to authenticated
  using (true);

-- New users insert their own row only. Rank is forced by the trigger to
-- 'tier_1' (or 'founder' for NSSC-0001), so the client cannot self-grant.
create policy "members: insert self"
  on public.members for insert
  to authenticated
  with check (auth.uid() = id);

-- Members may update their own row (name only in the app UI) but NOT rank,
-- member_number, email, or archetype once set.
create policy "members: self update profile"
  on public.members for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and rank = (select rank from public.members where id = auth.uid())
    and member_number = (select member_number from public.members where id = auth.uid())
    and email = (select email from public.members where id = auth.uid())
    and (
      (select archetype from public.members where id = auth.uid()) is null
      or archetype = (select archetype from public.members where id = auth.uid())
    )
    and token_balance = (select token_balance from public.members where id = auth.uid())
    and last_tribute_at is not distinct from (select last_tribute_at from public.members where id = auth.uid())
  );

-- Founders may update anyone (including rank).
create policy "members: founders update anyone"
  on public.members for update
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());

-- ---- events policies ----

create policy "events: read all"
  on public.events for select
  to authenticated
  using (true);

create policy "events: insert if approved"
  on public.events for insert
  to authenticated
  with check (host_id = auth.uid() and public.can_post_events());

create policy "events: host update own"
  on public.events for update
  to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy "events: host or founder delete"
  on public.events for delete
  to authenticated
  using (host_id = auth.uid() or public.is_founder());

-- ---- event_attendees policies ----

create policy "event_attendees: read all"
  on public.event_attendees for select
  to authenticated
  using (true);

create policy "event_attendees: join self"
  on public.event_attendees for insert
  to authenticated
  with check (member_id = auth.uid());

create policy "event_attendees: leave self"
  on public.event_attendees for delete
  to authenticated
  using (member_id = auth.uid() or public.is_founder());

-- ---- member_reward_glyphs policies ----

create policy "reward_glyphs: read all"
  on public.member_reward_glyphs for select
  to authenticated
  using (true);

create policy "reward_glyphs: founder insert"
  on public.member_reward_glyphs for insert
  to authenticated
  with check (public.is_founder());

-- ---- chat_messages policies ----

-- Members only ever see the last 24 hours of chat (sliding window).
create policy "chat: read recent"
  on public.chat_messages for select
  to authenticated
  using (created_at >= (now() - interval '24 hours'));

-- Insert as yourself; tier_1 is throttled to one message per 24h.
create policy "chat: insert as self"
  on public.chat_messages for insert
  to authenticated
  with check (
    member_id = auth.uid()
    and (
      public.can_chat_freely()
      or not exists (
        select 1 from public.chat_messages
        where member_id = auth.uid()
          and created_at > (now() - interval '24 hours')
      )
    )
  );

-- Members can delete their own; founders can delete any.
create policy "chat: delete own or founder"
  on public.chat_messages for delete
  to authenticated
  using (member_id = auth.uid() or public.is_founder());

-- ---- feature_requests policies ----

create policy "feature_requests: insert self"
  on public.feature_requests for insert
  to authenticated
  with check (member_id = auth.uid());

create policy "feature_requests: read own or founder"
  on public.feature_requests for select
  to authenticated
  using (member_id = auth.uid() or public.is_founder());

create policy "feature_requests: founder mark seen"
  on public.feature_requests for update
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());

-- ---- token_ledger policies ----

create policy "token_ledger: read own"
  on public.token_ledger for select
  to authenticated
  using (member_id = auth.uid());

-- ---- shore_recommendations policies ----

create policy "shore_recs: read all"
  on public.shore_recommendations for select
  to authenticated
  using (true);

create policy "shore_recs: insert self"
  on public.shore_recommendations for insert
  to authenticated
  with check (member_id = auth.uid());

create policy "shore_recs: delete own or founder"
  on public.shore_recommendations for delete
  to authenticated
  using (member_id = auth.uid() or public.is_founder());

-- ---- reliquary_redemptions policies (founder fulfillment inbox) ----

create policy "reliquary_redemptions: founder read"
  on public.reliquary_redemptions for select
  to authenticated
  using (public.is_founder());

create policy "reliquary_redemptions: founder mark seen"
  on public.reliquary_redemptions for update
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());

-- ---------- Realtime: broadcast chat_messages changes to subscribers ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;

-- ---------- Daily hard-reset of chat (pg_cron) ----------
-- Runs at 16:00 UTC daily = 04:00 NZST / 05:00 NZDT (early morning in NZ).
-- The RLS policy above already hides messages older than 24h from clients;
-- this job physically purges them so the table doesn't grow forever.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'nssc-purge-chat') then
    perform cron.unschedule('nssc-purge-chat');
  end if;
  perform cron.schedule(
    'nssc-purge-chat',
    '0 16 * * *',
    'delete from public.chat_messages where created_at < (now() - interval ''24 hours'')'
  );
end
$$;
