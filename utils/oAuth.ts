/**
 * Steward — OAuth helpers
 *
 * Google  → web OAuth flow via expo-web-browser (cross-platform)
 * Apple   → native Sign in with Apple on iOS (expo-apple-authentication)
 *           web OAuth flow fallback on Android / Web
 *
 * After a successful sign-in, Supabase's onAuthStateChange fires
 * automatically and AuthContext handles the redirect.
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Closes the browser tab on web after OAuth redirect completes
WebBrowser.maybeCompleteAuthSession();

// ── Internal: web-based OAuth flow ───────────────────────────────────────────
async function webOAuth(provider: 'google' | 'apple'): Promise<void> {
  const redirectTo = Linking.createURL('/');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true, // we open the browser ourselves
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned from Supabase');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  // User cancelled or dismissed the browser — not an error
  if (result.type !== 'success') return;

  // Supabase v2 PKCE: redirect back with ?code=… — exchange it for a session
  const parsedUrl = new URL(result.url);
  const code = parsedUrl.searchParams.get('code');

  if (code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(code);
    if (e) throw e;
    return;
  }

  // Implicit-flow fallback: access_token in URL hash fragment
  const hashParams = new URLSearchParams(parsedUrl.hash.replace('#', ''));
  const access_token  = hashParams.get('access_token');
  const refresh_token = hashParams.get('refresh_token');

  if (access_token && refresh_token) {
    const { error: e } = await supabase.auth.setSession({ access_token, refresh_token });
    if (e) throw e;
  }
}

// ── Public: Google ────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<void> {
  return webOAuth('google');
}

// ── Public: Apple ─────────────────────────────────────────────────────────────
export async function signInWithApple(): Promise<void> {
  // iOS: use native Sign in with Apple sheet (required by App Store guidelines)
  if (Platform.OS === 'ios') {
    const available = await AppleAuthentication.isAvailableAsync();

    if (available) {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        if (!credential.identityToken) {
          throw new Error('Apple did not return an identity token.');
        }

        // Exchange Apple token for a Supabase session
        const fullName =
          credential.fullName?.givenName && credential.fullName?.familyName
            ? `${credential.fullName.givenName} ${credential.fullName.familyName}`
            : credential.fullName?.givenName ?? undefined;

        const { data: idData, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: credential.authorizationCode ?? undefined,
        });

        // Backfill name if Apple provided it (only sent on first sign-in)
        if (!error && idData.user && fullName) {
          await supabase.auth.updateUser({ data: { name: fullName } });
        }

        if (error) throw error;
        return;
      } catch (e: any) {
        // ERR_CANCELED = user tapped "Cancel" — silently ignore
        if (e?.code === 'ERR_CANCELED') return;
        throw e;
      }
    }
  }

  // Android / Web: open Apple OAuth in the browser
  return webOAuth('apple');
}

// ── Helper: is native Apple auth available on this device? ───────────────────
export async function isAppleNativeAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}
