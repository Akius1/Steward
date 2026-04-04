-- ============================================================
-- Steward V2 Migration — Households + Currency
-- Run this in the Supabase SQL Editor AFTER migration v1 schema.sql
-- ============================================================

-- ── Add currency preference to profiles ───────────────────────
alter table public.profiles
  add column if not exists currency text not null default 'NGN';

-- ── Households ────────────────────────────────────────────────
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references auth.users on delete cascade not null,
  invite_code text unique not null,
  currency    text not null default 'NGN',
  created_at  timestamptz default now()
);
alter table public.households enable row level security;

-- Members can read any household they belong to; only owner can update/delete
create policy "households: members can read" on public.households
  for select using (
    auth.uid() = owner_id or
    exists (
      select 1 from public.household_members hm
      where hm.household_id = id and hm.user_id = auth.uid()
    )
  );
create policy "households: owner can insert" on public.households
  for insert with check (auth.uid() = owner_id);
create policy "households: owner can update" on public.households
  for update using (auth.uid() = owner_id);
create policy "households: owner can delete" on public.households
  for delete using (auth.uid() = owner_id);

-- ── Household Members ──────────────────────────────────────────
create table if not exists public.household_members (
  household_id uuid references public.households on delete cascade not null,
  user_id      uuid references auth.users on delete cascade not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz default now(),
  primary key (household_id, user_id)
);
alter table public.household_members enable row level security;

create policy "household_members: members can read" on public.household_members
  for select using (
    auth.uid() = user_id or
    exists (
      select 1 from public.household_members hm2
      where hm2.household_id = household_id and hm2.user_id = auth.uid()
    )
  );
create policy "household_members: insert via invite" on public.household_members
  for insert with check (auth.uid() = user_id);
create policy "household_members: owner can delete members" on public.household_members
  for delete using (
    auth.uid() = user_id or
    exists (
      select 1 from public.households h
      where h.id = household_id and h.owner_id = auth.uid()
    )
  );

-- ── Add household_id to income_sources ────────────────────────
alter table public.income_sources
  add column if not exists household_id uuid references public.households on delete set null;

-- ── Add household_id to allocations ───────────────────────────
alter table public.allocations
  add column if not exists household_id uuid references public.households on delete set null;

-- ── Helper: generate a short unique invite code ────────────────
create or replace function public.generate_invite_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text := '';
  i     int;
begin
  for i in 1..6 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return code;
end;
$$;
