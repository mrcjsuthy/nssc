-- =========================================================
-- NSSC // Supabase schema
-- Run this once in the Supabase SQL editor for a new project.
-- Idempotent: safe to re-run.
-- =========================================================

-- ---------- Member numbering sequence ----------
create sequence if not exists member_number_seq start 1;

-- ---------- members table ----------
create table if not exists public.members (
  id              uuid primary key references auth.users(id) on delete cascade,
  member_number   text unique,
  name            text not null,
  email           text unique not null,
  is_founder      boolean not null default false,
  can_post_events boolean not null default false,
  joined_at       timestamptz not null default now(),
  tee_claimed     boolean not null default false,
  tee_size        text,
  tee_address     jsonb,
  notes           text
);

create index if not exists members_member_number_idx on public.members(member_number);
create index if not exists members_joined_at_idx on public.members(joined_at);

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

-- ---------- Auto-assign chronological member number ----------
-- Member NSSC-0001 is automatically promoted to founder + event-poster.
create or replace function public.assign_member_number()
returns trigger
language plpgsql
security definer
as $$
declare
  next_num int;
begin
  if new.member_number is null then
    next_num := nextval('member_number_seq');
    new.member_number := 'NSSC-' || lpad(next_num::text, 4, '0');
    if next_num = 1 then
      new.is_founder := true;
      new.can_post_events := true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_member_number on public.members;
create trigger trg_assign_member_number
  before insert on public.members
  for each row execute function public.assign_member_number();

-- ---------- Helper: is current user a founder? ----------
create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    (select is_founder from public.members where id = auth.uid()),
    false
  );
$$;

create or replace function public.can_post_events()
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    (select can_post_events or is_founder from public.members where id = auth.uid()),
    false
  );
$$;

-- ---------- Row-Level Security ----------
alter table public.members enable row level security;
alter table public.events  enable row level security;

-- Drop and recreate policies idempotently
drop policy if exists "members: read all"                on public.members;
drop policy if exists "members: insert self"             on public.members;
drop policy if exists "members: self update profile"     on public.members;
drop policy if exists "members: founders update anyone"  on public.members;

drop policy if exists "events: read all"                 on public.events;
drop policy if exists "events: insert if approved"       on public.events;
drop policy if exists "events: host update own"          on public.events;
drop policy if exists "events: host or founder delete"   on public.events;

-- Any authenticated user can read the directory.
create policy "members: read all"
  on public.members for select
  to authenticated
  using (true);

-- A new user can insert ONLY their own row (id must equal auth.uid()),
-- and they cannot self-grant founder / can_post_events flags.
create policy "members: insert self"
  on public.members for insert
  to authenticated
  with check (
    auth.uid() = id
    and (is_founder = false or member_number is null)   -- trigger may promote NSSC-0001
    and (can_post_events = false or member_number is null)
  );

-- A member may update their own profile fields, but NOT their permission flags.
-- We enforce this with two policies: one for self-update of non-permission cols,
-- and a separate one allowing founders to update permissions on any row.
create policy "members: self update profile"
  on public.members for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_founder = (select is_founder from public.members where id = auth.uid())
    and can_post_events = (select can_post_events from public.members where id = auth.uid())
  );

create policy "members: founders update anyone"
  on public.members for update
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());

-- All members can read events.
create policy "events: read all"
  on public.events for select
  to authenticated
  using (true);

-- Only approved members (or founders) can create events, hosting as themselves.
create policy "events: insert if approved"
  on public.events for insert
  to authenticated
  with check (
    host_id = auth.uid()
    and public.can_post_events()
  );

-- Hosts can edit their own event.
create policy "events: host update own"
  on public.events for update
  to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

-- Hosts can delete their own; founders can delete anything.
create policy "events: host or founder delete"
  on public.events for delete
  to authenticated
  using (host_id = auth.uid() or public.is_founder());

-- ---------- Public view of upcoming events (optional, future use) ----------
-- (Kept commented; uncomment if you ever want an unauthenticated landing page
-- to show a teaser of upcoming events.)
-- create or replace view public.upcoming_events_public as
--   select id, title, event_date, location from public.events
--   where event_date >= now()
--   order by event_date;
