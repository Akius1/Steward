import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import type { Profile } from '@/types/database';

interface AuthCtxValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthCtx = createContext<AuthCtxValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string, fallbackName?: string) {
    const { data } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile(data);
    } else if (fallbackName) {
      // Profile row missing (user signed up before schema was applied) — create it now
      const { data: created } = await (supabase as any)
        .from('profiles')
        .upsert({ id: userId, name: fallbackName }, { onConflict: 'id' })
        .select()
        .single();
      if (created) setProfile(created);
    }
  }

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
        loadProfile(u.id, u.user_metadata?.name ?? u.email?.split('@')[0]);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, sess) => {
      setSession(sess);
      if (sess?.user) {
        const u = sess.user;
        loadProfile(u.id, u.user_metadata?.name ?? u.email?.split('@')[0]);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthCtx.Provider
      value={{ session, user: session?.user ?? null, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthCtxValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
