-- ============================================================
-- Steward — Fix household members visibility + shared budget RLS
--
-- Problems fixed:
--   1. "0 members" — hm: own row policy blocked seeing other members
--   2. PGRST200 — no FK between household_members and profiles
--   3. Shared budget — income_sources/allocations policies blocked
--      household members from reading each other's data
--
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times (idempotent).
-- ============================================================

-- ── 1. Fix household_members SELECT ──────────────────────────
-- Old policy only let you see your own row.
-- New: you can also see other rows in the same household
-- (via the security-definer is_household_member — no recursion).
drop policy if exists "hm: own row"           on public.household_members;
drop policy if exists "hm: see own household" on public.household_members;

create policy "hm: see own household" on public.household_members
  for select using (
    auth.uid() = user_id                          -- your own row
    or public.is_household_member(household_id)   -- or same household
  );

-- ── 2. Security-definer RPC to fetch household members + profiles ──
-- Avoids PGRST200 (no FK between household_members and profiles)
-- and avoids having to relax the profiles RLS policy globally.
create or replace function public.get_household_members(hh_id uuid)
returns table(
  user_id    uuid,
  role       text,
  joined_at  timestamptz,
  name       text,
  avatar_url text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    hm.user_id,
    hm.role,
    hm.joined_at,
    p.name,
    p.avatar_url
  from public.household_members hm
  left join public.profiles p on p.id = hm.user_id
  where hm.household_id = hh_id
    -- Only callable by actual members of the household
    and exists (
      select 1 from public.household_members me
      where me.household_id = hh_id
        and me.user_id = auth.uid()
    );
$$;

-- ── 3. Allow household members to read each other's shared income ──
drop policy if exists "income_sources: household read" on public.income_sources;
create policy "income_sources: household read" on public.income_sources
  for select using (
    auth.uid() = user_id
    or (
      household_id is not null
      and public.is_household_member(household_id)
    )
  );

-- ── 4. Allow household members to write shared income sources ─────
drop policy if exists "income_sources: household insert" on public.income_sources;
create policy "income_sources: household insert" on public.income_sources
  for insert with check (
    auth.uid() = user_id
    or (
      household_id is not null
      and public.is_household_member(household_id)
    )
  );

drop policy if exists "income_sources: household update" on public.income_sources;
create policy "income_sources: household update" on public.income_sources
  for update using (
    auth.uid() = user_id
    or (
      household_id is not null
      and public.is_household_member(household_id)
    )
  );

drop policy if exists "income_sources: household delete" on public.income_sources;
create policy "income_sources: household delete" on public.income_sources
  for delete using (
    auth.uid() = user_id
    or (
      household_id is not null
      and public.is_household_member(household_id)
    )
  );

-- ── 5. Allow household members to read/write shared allocations ───
drop policy if exists "allocations: household read" on public.allocations;
create policy "allocations: household read" on public.allocations
  for select using (
    auth.uid() = user_id
    or (
      household_id is not null
      and public.is_household_member(household_id)
    )
  );

drop policy if exists "allocations: household insert" on public.allocations;
create policy "allocations: household insert" on public.allocations
  for insert with check (
    auth.uid() = user_id
    or (
      household_id is not null
      and public.is_household_member(household_id)
    )
  );

drop policy if exists "allocations: household update" on public.allocations;
create policy "allocations: household update" on public.allocations
  for update using (
    auth.uid() = user_id
    or (
      household_id is not null
      and public.is_household_member(household_id)
    )
  );

drop policy if exists "allocations: household delete" on public.allocations;
create policy "allocations: household delete" on public.allocations
  for delete using (
    auth.uid() = user_id
    or (
      household_id is not null
      and public.is_household_member(household_id)
    )
  );
