-- ============================================================
-- Steward — Fix RLS infinite recursion (42P17)
-- Run this in the Supabase SQL Editor if you already ran
-- migration_v2.sql and hit the "infinite recursion detected
-- in policy for relation household_members" error.
--
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================

-- 1. Drop the recursive policies
drop policy if exists "hm: members read"       on public.household_members;
drop policy if exists "households: members read" on public.households;

-- 2. Create a SECURITY DEFINER helper that reads household_members
--    WITHOUT triggering its own RLS — this breaks the recursion.
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

-- 3. Each user sees only their own membership row (non-recursive)
create policy "hm: own row" on public.household_members
  for select using (auth.uid() = user_id);

-- 4. Household members can read their household via the helper
create policy "households: members read" on public.households
  for select using (
    auth.uid() = owner_id
    or public.is_household_member(id)
  );
