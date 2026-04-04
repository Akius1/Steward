import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!;

// SecureStore has a 2 KB per-value limit but Supabase session JWTs are larger.
// We chunk large values into 1900-byte pieces and reassemble them on read.
const CHUNK = 1900;

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  }
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__n`);
    if (!countStr) return SecureStore.getItemAsync(key);
    const count = parseInt(countStr, 10);
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}__${i}`))
    );
    if (parts.some((p) => p === null)) return null;
    return parts.join('');
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  try {
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK);
    await Promise.all(
      Array.from({ length: chunks }, (_, i) =>
        SecureStore.setItemAsync(`${key}__${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
      )
    );
    await SecureStore.setItemAsync(`${key}__n`, String(chunks));
  } catch {}
}

async function secureRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__n`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`))
      );
      await SecureStore.deleteItemAsync(`${key}__n`);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {}
}

const storage = {
  getItem: secureGet,
  setItem: secureSet,
  removeItem: secureRemove,
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Pause/resume token auto-refresh based on app foreground state
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
