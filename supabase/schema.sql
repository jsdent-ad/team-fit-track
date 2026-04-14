-- Team Fit-Track — Supabase Schema
-- Paste into Supabase dashboard → SQL editor → "New query" → Run.

-- 1. Tables --------------------------------------------------------------

create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  password_hash text not null,
  goal_type text not null default 'weight' check (goal_type in ('weight','bodyFat','skeletalMuscle')),
  goal_start numeric not null default 0,
  goal_target numeric not null default 0,
  goal_current numeric not null default 0,
  goal_unit text not null default 'kg',
  tour_completed boolean not null default false,
  celebrated boolean not null default false,
  created_at timestamptz default now(),
  unique (team_id, lower(name))
);

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  image_data_url text not null,
  caption text,
  created_at timestamptz default now()
);

create table if not exists public.team_challenges (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade unique,
  title text not null,
  target_count integer not null,
  theme_emoji text default '🏆',
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now()
);

create index if not exists members_team_id_idx on public.members(team_id);
create index if not exists certifications_team_id_idx on public.certifications(team_id);
create index if not exists certifications_member_id_idx on public.certifications(member_id);

-- 2. Row Level Security --------------------------------------------------
-- MVP: app-level checks via anon key + team code knowledge.
-- RLS enabled but permissive (anyone with team_id from a known code can read/write).
-- If you outgrow this, add per-team JWT auth.

alter table public.teams              enable row level security;
alter table public.members            enable row level security;
alter table public.certifications     enable row level security;
alter table public.team_challenges    enable row level security;

drop policy if exists "anon all teams"         on public.teams;
drop policy if exists "anon all members"       on public.members;
drop policy if exists "anon all certs"         on public.certifications;
drop policy if exists "anon all challenges"    on public.team_challenges;

create policy "anon all teams"       on public.teams              for all using (true) with check (true);
create policy "anon all members"     on public.members            for all using (true) with check (true);
create policy "anon all certs"       on public.certifications     for all using (true) with check (true);
create policy "anon all challenges"  on public.team_challenges    for all using (true) with check (true);

-- 3. Realtime ------------------------------------------------------------

alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.certifications;
alter publication supabase_realtime add table public.team_challenges;
