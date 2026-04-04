-- ============================================================
-- Steward V1 — Database Schema
-- Run this in the Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- ── Profiles ──────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  name       text not null,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ── Income Sources ────────────────────────────────────────────
create table if not exists public.income_sources (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade not null,
  name       text not null,
  type       text not null check (type in ('SALARY','FREELANCE','BUSINESS','GIFT','SIDE INCOME')),
  amount     integer not null,
  subtitle   text,
  created_at timestamptz default now()
);
alter table public.income_sources enable row level security;

create policy "income_sources: own rows" on public.income_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Allocations ───────────────────────────────────────────────
create table if not exists public.allocations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  month       integer not null check (month between 1 and 12),
  year        integer not null,
  bucket_name text not null,
  amount      integer not null,
  pct         numeric(6,2) not null,
  created_at  timestamptz default now(),
  unique (user_id, month, year, bucket_name)
);
alter table public.allocations enable row level security;

create policy "allocations: own rows" on public.allocations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Milestones ────────────────────────────────────────────────
create table if not exists public.milestones (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  name            text not null,
  icon            text not null default 'flag-outline',
  target_amount   integer not null,
  saved_amount    integer not null default 0,
  monthly_saving  integer not null,
  deadline_months integer,
  created_at      timestamptz default now()
);
alter table public.milestones enable row level security;

create policy "milestones: own rows" on public.milestones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Auto-create profile on signup ────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'User'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
