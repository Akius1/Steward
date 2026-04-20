import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { TextInput, View, Text } from 'react-native';

// Closes the in-app browser after OAuth redirect on web
WebBrowser.maybeCompleteAuthSession();

// ─── Polyfill ─────────────────────────────────────────────────────────────────
// @gorhom/bottom-sheet calls TextInput.State.currentlyFocusedInput() which
// was removed from react-native-web. Patch it before any sheet mounts.
const _rnts = (TextInput as any).State;
if (_rnts && typeof _rnts.currentlyFocusedInput !== 'function') {
  _rnts.currentlyFocusedInput = () => _rnts.currentlyFocusedField?.() ?? null;
}
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import {
  Fraunces_900Black,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
} from '@expo-google-fonts/fraunces';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';

import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import BiometricLock from '@/src/components/BiometricLock';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_900Black,
    Fraunces_700Bold,
    Fraunces_700Bold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    // Don't throw — log font errors and continue with system fonts
    if (error) console.warn('Font load error (non-fatal):', error);
  }, [error]);

  useEffect(() => {
    // Hide splash once fonts load or fail — never stay stuck
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <BottomSheetModalProvider>
            <BiometricLock>
              <RootLayoutNav />
            </BiometricLock>
          </BottomSheetModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// ─── Auth-gated navigator ─────────────────────────────────────────────────────
function RootLayoutNav() {
  const { session, loading, profile } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = (segments[0] as string) === '(auth)';
    const inOnboarding = (segments[0] as string) === 'onboarding';

    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && inAuth) {
      // Wait for profile to load before deciding onboarding vs tabs
      if (profile === null) return;
      if (!profile.onboarding_done) {
        router.replace('/onboarding' as any);
      } else {
        router.replace('/(tabs)');
      }
    } else if (session && !inAuth && !inOnboarding && profile && !profile.onboarding_done) {
      router.replace('/onboarding' as any);
    }
  }, [session, loading, segments, profile]);

  // Keep splash visible while checking session
  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ai-coach" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="debt-planner" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="transactions" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true }} />
    </Stack>
  );
}
