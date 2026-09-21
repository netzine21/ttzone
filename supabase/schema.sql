-- TTGMS shared database schema.
-- Run this file once in Supabase SQL Editor before connecting the Render service.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  member_id text not null unique,
  password_hash text not null,
  gender text not null check (gender in ('male', 'female')),
  rank text not null,
  phone text not null,
  region text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.users(id) on delete restrict,
  title text not null,
  location text not null,
  scheduled_at timestamptz not null,
  max_participants integer not null check (max_participants > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.games
  add column if not exists qualifying_groups jsonb not null default '{}'::jsonb,
  add column if not exists preliminary_matches jsonb not null default '{}'::jsonb,
  add column if not exists tournaments jsonb not null default '{}'::jsonb,
  add column if not exists registration_closed jsonb not null default '{}'::jsonb,
  add column if not exists format_modes jsonb not null default '{}'::jsonb;

create table if not exists public.game_formats (
  game_id uuid not null references public.games(id) on delete cascade,
  format text not null check (format in ('singles', 'doubles', 'team')),
  primary key (game_id, format)
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  format text not null check (format in ('singles', 'doubles', 'team')),
  user_id uuid references public.users(id) on delete set null,
  nickname text not null,
  member_id text,
  rank text not null,
  team_name text,
  registered_by uuid references public.users(id) on delete set null,
  registration_source text not null default 'bulk' check (registration_source in ('online', 'bulk', 'manual')),
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (format = 'singles' or nullif(trim(team_name), '') is not null)
);

create unique index if not exists registrations_user_format_key
  on public.registrations (game_id, format, user_id)
  where user_id is not null;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  format text not null check (format in ('singles', 'doubles', 'team')),
  group_name text not null,
  group_order integer not null,
  created_at timestamptz not null default now(),
  unique (game_id, format, group_name)
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (group_id, registration_id)
);

create table if not exists public.league_matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  round_number integer not null,
  match_order integer not null,
  side_a_group_member_id uuid references public.group_members(id) on delete set null,
  side_b_group_member_id uuid references public.group_members(id) on delete set null,
  score_a text,
  score_b text,
  winner_side text check (winner_side in ('A', 'B')),
  result_saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, match_order)
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  format text not null check (format in ('singles', 'doubles', 'team')),
  league text not null check (league in ('upper', 'lower')),
  advance_count integer not null default 2 check (advance_count between 1 and 4),
  bracket_size integer not null check (bracket_size >= 2),
  status text not null default 'created' check (status in ('created', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, format, league)
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number integer not null,
  match_order integer not null,
  side_a jsonb,
  side_b jsonb,
  score_a text,
  score_b text,
  winner_side text check (winner_side in ('A', 'B')),
  result_saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round_number, match_order)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists games_operator_id_idx on public.games(operator_id);
create index if not exists games_scheduled_at_idx on public.games(scheduled_at);
create index if not exists registrations_game_format_idx on public.registrations(game_id, format);
create index if not exists groups_game_format_idx on public.groups(game_id, format);
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_expires_at_idx on public.sessions(expires_at);

-- This application will access the database through the Render backend.
-- Keep tables protected from direct browser access until explicit policies exist.
alter table public.users enable row level security;
alter table public.games enable row level security;
alter table public.game_formats enable row level security;
alter table public.registrations enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.league_matches enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.sessions enable row level security;
