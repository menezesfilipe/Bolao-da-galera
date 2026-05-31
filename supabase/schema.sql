create extension if not exists "pgcrypto";

create table if not exists public.boloes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  organizer_id text not null,
  organizer_name text not null,
  entry_fee numeric(10,2) not null default 0,
  pix_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  bolao_id uuid not null references public.boloes(id) on delete cascade,
  user_id text not null,
  name text not null,
  email text,
  role text not null default 'player' check (role in ('organizer', 'player')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  bolao_id uuid not null references public.boloes(id) on delete cascade,
  stage text not null,
  home_team text not null,
  away_team text not null,
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'finished')),
  home_score integer,
  away_score integer,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bolao_id, home_team, away_team, starts_at)
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  bolao_id uuid not null references public.boloes(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, match_id)
);

create index if not exists participants_bolao_id_idx on public.participants(bolao_id);
create index if not exists predictions_bolao_id_idx on public.predictions(bolao_id);
create index if not exists predictions_participant_id_idx on public.predictions(participant_id);
create index if not exists matches_status_idx on public.matches(status);
create index if not exists matches_bolao_id_idx on public.matches(bolao_id);
create unique index if not exists participants_bolao_user_idx on public.participants(bolao_id, user_id);

alter table public.boloes enable row level security;
alter table public.participants enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

create policy "Public read boloes" on public.boloes for select using (true);
create policy "Public insert boloes" on public.boloes for insert with check (true);
create policy "Public update boloes" on public.boloes for update using (true) with check (true);

create policy "Public read participants" on public.participants for select using (true);
create policy "Public insert participants" on public.participants for insert with check (true);
create policy "Public update participants" on public.participants for update using (true) with check (true);

create policy "Public read matches" on public.matches for select using (true);
create policy "Public insert matches" on public.matches for insert with check (true);
create policy "Public update matches" on public.matches for update using (true) with check (true);

create policy "Public read predictions" on public.predictions for select using (true);
create policy "Public insert predictions" on public.predictions for insert with check (true);
create policy "Public update predictions" on public.predictions for update using (true) with check (true);
