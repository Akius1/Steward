import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  AppStateStatus,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '@/constants/theme';

// Biometric lock is native-only — expo-secure-store + LocalAuthentication
// have no web implementations. Return children immediately on web.
const IS_NATIVE = Platform.OS !== 'web';

// Safe wrappers so SecureStore calls never throw on web
const store = {
  get: (key: string) => IS_NATIVE ? SecureStore.getItemAsync(key) : Promise.resolve(null),
  set: (key: string, val: string) => IS_NATIVE ? SecureStore.setItemAsync(key, val) : Promise.resolve(),
};

const BIOMETRIC_PREF_KEY = 'steward_biometric_enabled';
// Milliseconds of background before lock re-triggers (30 seconds)
const LOCK_THRESHOLD_MS = 30_000;

interface BiometricLockProps {
  children: React.ReactNode;
}

export default function BiometricLock({ children }: BiometricLockProps) {
  const [locked, setLocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Load pref once on mount
  useEffect(() => {
    if (!IS_NATIVE) return;
    store.get(BIOMETRIC_PREF_KEY).then((v) => {
      const on = v === 'true';
      setEnabled(on);
      if (on) {
        // Lock immediately on first load
        setLocked(true);
      }
    });
  }, []);

  // Re-check pref whenever app comes to foreground (user may have toggled in Settings)
  const handleAppStateChange = useCallback(async (nextState: AppStateStatus) => {
    if (!IS_NATIVE) return;
    const prev = appState.current;
    appState.current = nextState;

    const isEnabled = (await store.get(BIOMETRIC_PREF_KEY)) === 'true';
    setEnabled(isEnabled);

    if (prev === 'active' && (nextState === 'background' || nextState === 'inactive')) {
      backgroundedAt.current = Date.now();
    }

    if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
      if (!isEnabled) return;
      const elapsed = backgroundedAt.current ? Date.now() - backgroundedAt.current : Infinity;
      if (elapsed > LOCK_THRESHOLD_MS) {
        setLocked(true);
      }
      backgroundedAt.current = null;
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [handleAppStateChange]);

  const authenticate = useCallback(async () => {
    if (authenticating) return;
    setAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Steward',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        setLocked(false);
      }
    } finally {
      setAuthenticating(false);
    }
  }, [authenticating]);

  // Auto-trigger biometric prompt when lock screen appears
  useEffect(() => {
    if (locked) {
      // Small delay so the lock UI renders first
      const t = setTimeout(() => authenticate(), 300);
      return () => clearTimeout(t);
    }
  }, [locked]);

  // Web: biometric not supported — pass through immediately
  if (!IS_NATIVE || !locked || !enabled) {
    return <>{children}</>;
  }

  return (
    <LinearGradient
      colors={['#210909', '#4E0B0B']}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Logo mark */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>S</Text>
        </View>

        <Text style={styles.title}>Steward</Text>
        <Text style={styles.subtitle}>Your finances are locked</Text>

        {authenticating ? (
          <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
        ) : (
          <TouchableOpacity style={styles.unlockBtn} onPress={authenticate} activeOpacity={0.8}>
            <Ionicons name="finger-print-outline" size={24} color="#210909" />
            <Text style={styles.unlockText}>Unlock with Biometrics</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>
          {authenticating ? 'Waiting for authentication…' : 'Tap to authenticate'}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  logoText: {
    fontFamily: FONTS.display,
    fontSize: 44,
    color: '#210909',
    lineHeight: 52,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 48,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#D4AF37',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 16,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  unlockText: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: '#210909',
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 20,
  },
});
