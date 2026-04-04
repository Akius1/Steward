import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import type { Profile, Household, HouseholdMember } from '@/types/database';
import type { CurrencyCode } from '@/utils/currency';

interface AuthCtxValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  household: Household | null;
  householdMembers: HouseholdMember[];
  currency: CurrencyCode;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshHousehold: () => Promise<void>;
  setCurrency: (c: CurrencyCode) => Promise<void>;
}

const AuthCtx = createContext<AuthCtxValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Profile ────────────────────────────────────────────────────────────────
  async function loadProfile(userId: string, fallbackName?: string) {
    const { data } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile(data);
    } else if (fallbackName) {
      const { data: created } = await (supabase as any)
        .from('profiles')
        .upsert({ id: userId, name: fallbackName, currency: 'NGN' }, { onConflict: 'id' })
        .select()
        .single();
      if (created) setProfile(created);
    }
  }

  // ── Household ──────────────────────────────────────────────────────────────
  async function loadHousehold(userId: string) {
    // Find any household this user belongs to
    const { data: membership } = await (supabase as any)
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (!membership) { setHousehold(null); setHouseholdMembers([]); return; }

    const { data: hh } = await (supabase as any)
      .from('households')
      .select('*')
      .eq('id', membership.household_id)
      .single();
    if (hh) setHousehold(hh);

    // Load members with their profiles
    const { data: members } = await (supabase as any)
      .from('household_members')
      .select('*, profile:profiles(*)')
      .eq('household_id', membership.household_id);
    if (members) setHouseholdMembers(members);
  }

  async function refreshHousehold() {
    if (session?.user) await loadHousehold(session.user.id);
  }

  // ── Currency ───────────────────────────────────────────────────────────────
  async function setCurrency(c: CurrencyCode) {
    if (!session?.user) return;
    await (supabase as any)
      .from('profiles')
      .update({ currency: c })
      .eq('id', session.user.id);
    setProfile((p) => p ? { ...p, currency: c } : p);
  }

  const currency: CurrencyCode = profile?.currency ?? household?.currency ?? 'NGN';

  // ── Auth lifecycle ─────────────────────────────────────────────────────────
  async function refreshProfile() {
    if (session?.user) {
      const u = session.user;
      await loadProfile(u.id, u.user_metadata?.name ?? u.email?.split('@')[0]);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const u = data.session.user;
        Promise.all([
          loadProfile(u.id, u.user_metadata?.name ?? u.email?.split('@')[0]),
          loadHousehold(u.id),
        ]).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, sess) => {
      setSession(sess);
      if (sess?.user) {
        const u = sess.user;
        loadProfile(u.id, u.user_metadata?.name ?? u.email?.split('@')[0]);
        loadHousehold(u.id);
      } else {
        setProfile(null);
        setHousehold(null);
        setHouseholdMembers([]);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setHousehold(null);
    setHouseholdMembers([]);
  }

  return (
    <AuthCtx.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      household,
      householdMembers,
      currency,
      loading,
      signOut,
      refreshProfile,
      refreshHousehold,
      setCurrency,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthCtxValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
