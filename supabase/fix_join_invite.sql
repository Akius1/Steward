-- ============================================================
-- Steward — Fix "household not found" when joining via invite code
--
-- Root cause: the households SELECT policy only lets a user read
-- a household if they are already a member or owner. A joining
-- user is neither yet, so the invite-code lookup returns nothing.
--
-- Fix: a SECURITY DEFINER function that bypasses RLS for the
-- invite-code lookup only. It returns just id + name + currency
-- (no invite_code or owner_id exposed).
--
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times (CREATE OR REPLACE + IF NOT EXISTS).
-- ============================================================

create or replace function public.find_household_by_invite(code text)
returns table(id uuid, name text, currency text)
language sql
security definer
stable
set search_path = public
as $$
  select id, name, currency
  from   public.households
  where  invite_code = upper(trim(code))
  limit  1;
$$;
