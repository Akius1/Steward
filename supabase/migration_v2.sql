-- ============================================================
-- Steward V2 Migration — Households + Currency
-- Run this in the Supabase SQL Editor AFTER schema.sql (v1)
-- ============================================================

-- ── 1. Add currency to profiles ───────────────────────────────
alter table public.profiles
  add column if not exists currency text not null default 'NGN';

-- ── 2. Create households table ────────────────────────────────
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references auth.users on delete cascade not null,
  invite_code text unique not null,
  currency    text not null default 'NGN',
  created_at  timestamptz default now()
);
alter table public.households enable row level security;

create policy "households: owner insert" on public.households
  for insert with check (auth.uid() = owner_id);

create policy "households: owner update" on public.households
  for update using (auth.uid() = owner_id);

create policy "households: owner delete" on public.households
  for delete using (auth.uid() = owner_id);

-- ── 3. Create household_members table ────────────────────────
create table if not exists public.household_members (
  household_id uuid references public.households on delete cascade not null,
  user_id      uuid references auth.users on delete cascade not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz default now(),
  primary key (household_id, user_id)
);
alter table public.household_members enable row level security;

-- ── 4. Security-definer helper — reads household_members WITHOUT
--       triggering its own RLS (prevents infinite recursion) ──
create or replace function public.is_household_member(hh_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hh_id
      and user_id = auth.uid()
  );
$$;

-- ── 5. households SELECT — uses the helper, not a direct subquery
create policy "households: members read" on public.households
  for select using (
    auth.uid() = owner_id
    or public.is_household_member(id)
  );

-- ── 6. household_members policies (non-recursive) ─────────────
-- Each user may only SELECT their own membership row.
-- Checking whether a user belongs to a household should go through
-- is_household_member(), not a self-referencing subquery.
create policy "hm: own row" on public.household_members
  for select using (auth.uid() = user_id);

create policy "hm: join via invite" on public.household_members
  for insert with check (auth.uid() = user_id);

create policy "hm: leave or owner remove" on public.household_members
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.households h
      where h.id = household_id and h.owner_id = auth.uid()
    )
  );

-- ── 7. Add household_id FK to income_sources ──────────────────
alter table public.income_sources
  add column if not exists household_id uuid
    references public.households on delete set null;

-- ── 8. Add household_id FK to allocations ─────────────────────
alter table public.allocations
  add column if not exists household_id uuid
    references public.households on delete set null;
