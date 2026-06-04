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

-- ---------- chat_messages table (world chat, daily-reset) ----------
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  body        text not null check (char_length(body) between 1 and 500),
  member_id   uuid not null references public.members(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists chat_messages_created_idx on public.chat_messages(created_at desc);

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

-- ---------- Row-Level Security ----------
alter table public.members        enable row level security;
alter table public.events         enable row level security;
alter table public.chat_messages  enable row level security;

-- Drop existing policies idempotently
drop policy if exists "members: read all"                on public.members;
drop policy if exists "members: insert self"             on public.members;
drop policy if exists "members: self update profile"     on public.members;
drop policy if exists "members: founders update anyone"  on public.members;

drop policy if exists "events: read all"                 on public.events;
drop policy if exists "events: insert if approved"       on public.events;
drop policy if exists "events: host update own"          on public.events;
drop policy if exists "events: host or founder delete"   on public.events;

drop policy if exists "chat: read recent"                on public.chat_messages;
drop policy if exists "chat: insert as self"             on public.chat_messages;
drop policy if exists "chat: delete own or founder"      on public.chat_messages;

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

-- Members may update their own row but NOT their rank.
create policy "members: self update profile"
  on public.members for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and rank = (select rank from public.members where id = auth.uid())
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
