-- ============================================================
-- Steward V2 Migration — Households + Currency
-- Run this in the Supabase SQL Editor AFTER schema.sql (v1)
-- ============================================================

-- ── 1. Add currency to profiles ───────────────────────────────
alter table public.profiles
  add column if not exists currency text not null default 'NGN';

-- ── 2. Create households (no cross-table policy yet) ──────────
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references auth.users on delete cascade not null,
  invite_code text unique not null,
  currency    text not null default 'NGN',
  created_at  timestamptz default now()
);
alter table public.households enable row level security;

-- Simple owner policies — no reference to household_members yet
create policy "households: owner insert" on public.households
  for insert with check (auth.uid() = owner_id);

create policy "households: owner update" on public.households
  for update using (auth.uid() = owner_id);

create policy "households: owner delete" on public.households
  for delete using (auth.uid() = owner_id);

-- ── 3. Create household_members ───────────────────────────────
create table if not exists public.household_members (
  household_id uuid references public.households on delete cascade not null,
  user_id      uuid references auth.users on delete cascade not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz default now(),
  primary key (household_id, user_id)
);
alter table public.household_members enable row level security;

-- ── 4. Now add cross-table SELECT policy on households ────────
-- (household_members exists now so the subquery is valid)
create policy "households: members read" on public.households
  for select using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.household_members m
      where m.household_id = public.households.id
        and m.user_id = auth.uid()
    )
  );

-- ── 5. Policies on household_members ──────────────────────────
create policy "hm: members read" on public.household_members
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.household_members m2
      where m2.household_id = household_id
        and m2.user_id = auth.uid()
    )
  );

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

-- ── 6. Add household_id FK to income_sources ──────────────────
alter table public.income_sources
  add column if not exists household_id uuid references public.households on delete set null;

-- ── 7. Add household_id FK to allocations ─────────────────────
alter table public.allocations
  add column if not exists household_id uuid references public.households on delete set null;
