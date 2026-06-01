create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('organizer', 'player')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
alter table public.profiles enable row level security;
alter table public.participants enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

create policy "Read own profile" on public.profiles for select using (id = auth.uid());
create policy "Insert own profile" on public.profiles for insert with check (id = auth.uid());
create policy "Update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Read auth boloes" on public.boloes for select using (auth.role() = 'authenticated');
create policy "Insert own boloes" on public.boloes for insert with check (organizer_id = auth.uid()::text);
create policy "Update own boloes" on public.boloes for update using (organizer_id = auth.uid()::text) with check (organizer_id = auth.uid()::text);
create policy "Delete own boloes" on public.boloes for delete using (organizer_id = auth.uid()::text);

create policy "Read related participants" on public.participants for select using (
  user_id = auth.uid()::text
  or exists (
    select 1 from public.boloes b
    where b.id = bolao_id
      and b.organizer_id = auth.uid()::text
  )
);
create policy "Insert self participant" on public.participants for insert with check (
  user_id = auth.uid()::text
  or exists (
    select 1 from public.boloes b
    where b.id = bolao_id
      and b.organizer_id = auth.uid()::text
  )
);
create policy "Update related participants" on public.participants for update using (
  user_id = auth.uid()::text
  or exists (
    select 1 from public.boloes b
    where b.id = bolao_id
      and b.organizer_id = auth.uid()::text
  )
) with check (
  user_id = auth.uid()::text
  or exists (
    select 1 from public.boloes b
    where b.id = bolao_id
      and b.organizer_id = auth.uid()::text
  )
);

create policy "Read related matches" on public.matches for select using (
  exists (
    select 1 from public.boloes b
    where b.id = bolao_id
      and (b.organizer_id = auth.uid()::text or auth.role() = 'authenticated')
  )
);
create policy "Insert own matches" on public.matches for insert with check (
  exists (
    select 1 from public.boloes b
    where b.id = bolao_id
      and b.organizer_id = auth.uid()::text
  )
);
create policy "Update own matches" on public.matches for update using (
  exists (
    select 1 from public.boloes b
    where b.id = bolao_id
      and b.organizer_id = auth.uid()::text
  )
) with check (
  exists (
    select 1 from public.boloes b
    where b.id = bolao_id
      and b.organizer_id = auth.uid()::text
  )
);

create policy "Read related predictions" on public.predictions for select using (
  exists (
    select 1 from public.participants p
    where p.id = participant_id
      and (p.user_id = auth.uid()::text or exists (
        select 1 from public.boloes b
        where b.id = p.bolao_id
          and b.organizer_id = auth.uid()::text
      ))
  )
);
create policy "Insert own predictions" on public.predictions for insert with check (
  exists (
    select 1 from public.participants p
    where p.id = participant_id
      and p.user_id = auth.uid()::text
  )
);
create policy "Update own predictions" on public.predictions for update using (
  exists (
    select 1 from public.participants p
    where p.id = participant_id
      and p.user_id = auth.uid()::text
  )
) with check (
  exists (
    select 1 from public.participants p
    where p.id = participant_id
      and p.user_id = auth.uid()::text
  )
);
