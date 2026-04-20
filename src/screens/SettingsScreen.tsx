import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { CURRENCIES as CURR_MAP } from '@/utils/currency';
import type { CurrencyCode } from '@/utils/currency';
import {
  getNotificationsEnabled,
  requestPermissionsAndEnable,
  disableNotifications,
} from '@/utils/notifications';

const CURR_LIST = Object.keys(CURR_MAP) as CurrencyCode[];
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const BIOMETRIC_PREF_KEY = 'steward_biometric_enabled';

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={{ fontFamily: FONTS.semibold, fontSize: 11, color: colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, paddingHorizontal: 20 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 20, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

// ─── Row item ─────────────────────────────────────────────────────────────────
function Row({
  icon, label, value, onPress, danger, trailing, last,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
  last?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 15,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !trailing}
    >
      <View style={{
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: danger ? 'rgba(239,68,68,0.12)' : colors.goldBg,
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.gold} />
      </View>
      <Text style={{ flex: 1, fontFamily: FONTS.medium, fontSize: 15, color: danger ? colors.danger : colors.textPrimary }}>
        {label}
      </Text>
      {value ? (
        <Text style={{ fontFamily: FONTS.regular, fontSize: 14, color: colors.textMuted, marginRight: 6 }}>
          {value}
        </Text>
      ) : null}
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null)}
    </TouchableOpacity>
  );
}

// ─── Currency picker modal ─────────────────────────────────────────────────────
function CurrencyPicker({ visible, current, onSelect, onClose }: {
  visible: boolean; current: CurrencyCode; onSelect: (c: CurrencyCode) => void; onClose: () => void;
}) {
  const { colors, isDark } = useTheme();
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} activeOpacity={1} />
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '70%',
      }}>
        <View style={{ padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 18, color: colors.textPrimary }}>Select Currency</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {CURR_LIST.map((c) => {
            const meta = CURR_MAP[c];
            const active = c === current;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => { onSelect(c); onClose(); }}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, paddingVertical: 14,
                  borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
                  backgroundColor: active ? colors.goldBg : 'transparent',
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 22, marginRight: 14 }}>{meta.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary }}>{c}</Text>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>{meta.name}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.gold} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { colors, isDark, colorMode, setColorMode } = useTheme();
  const { profile, user, currency, setCurrency, signOut, refreshProfile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(profile?.name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Feature 8 — Notifications
  const [notificationsOn, setNotificationsOn] = useState(false);
  // Feature 9 — Biometric
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);

  useEffect(() => {
    getNotificationsEnabled().then(setNotificationsOn);
    LocalAuthentication.hasHardwareAsync().then((has) => {
      if (has) {
        LocalAuthentication.isEnrolledAsync().then((enrolled) => setBiometricAvailable(enrolled));
      }
    });
    SecureStore.getItemAsync(BIOMETRIC_PREF_KEY).then((v) => setBiometricOn(v === 'true'));
  }, []);

  async function handleNotificationsToggle(value: boolean) {
    if (value) {
      const granted = await requestPermissionsAndEnable();
      if (!granted) {
        Alert.alert(
          'Permission denied',
          'Enable notifications in your device Settings to receive Steward reminders.'
        );
        return;
      }
      setNotificationsOn(true);
    } else {
      await disableNotifications();
      setNotificationsOn(false);
    }
  }

  async function handleBiometricToggle(value: boolean) {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm your identity to enable app lock',
        fallbackLabel: 'Use passcode',
      });
      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, 'true');
        setBiometricOn(true);
      } else {
        Alert.alert('Authentication failed', 'Could not enable biometric lock.');
      }
    } else {
      await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, 'false');
      setBiometricOn(false);
    }
  }

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name required', 'Please enter your display name.'); return; }
    if (!user) return;
    setSavingName(true);
    const { error } = await supabase.from('profiles' as any).update({ name: trimmed }).eq('id', user.id);
    setSavingName(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await refreshProfile();
    setEditingName(false);
  }

  function handleSignOut() {
    Alert.alert(
      'Sign out',
      'You will need to sign back in to access your Steward account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out', style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
          },
        },
      ]
    );
  }

  const firstName = (profile?.name ?? 'U').split(' ')[0];
  const initial = (profile?.name ?? 'U').charAt(0).toUpperCase();
  const currMeta = CURR_MAP[currency];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ─────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: FONTS.heading, fontSize: 24, color: colors.textPrimary, flex: 1 }}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Profile Card ──────────────────────────── */}
        <View style={{
          marginHorizontal: 20, marginBottom: 28,
          backgroundColor: colors.card, borderRadius: 20, padding: 20,
          alignItems: 'center',
        }}>
          {/* Avatar */}
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: colors.burgundy,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
            borderWidth: 3, borderColor: colors.gold + '40',
          }}>
            <Text style={{ fontFamily: FONTS.heading, fontSize: 30, color: colors.gold }}>{initial}</Text>
          </View>

          {/* Name edit */}
          {editingName ? (
            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1, fontFamily: FONTS.semibold, fontSize: 18, color: colors.textPrimary,
                  backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14,
                  paddingVertical: 10, borderWidth: 1.5, borderColor: colors.gold,
                }}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                cursorColor={colors.gold}
              />
              <TouchableOpacity
                onPress={handleSaveName}
                disabled={savingName}
                style={{ backgroundColor: colors.burgundy, borderRadius: 10, padding: 12 }}
              >
                {savingName
                  ? <ActivityIndicator size="small" color={colors.gold} />
                  : <Ionicons name="checkmark" size={18} color={colors.gold} />
                }
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setEditingName(false); setName(profile?.name ?? ''); }}
                style={{ padding: 12 }}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setEditingName(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary }}>{profile?.name ?? firstName}</Text>
              <Ionicons name="pencil-outline" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            {user?.email ?? ''}
          </Text>

          {/* Subscription badge */}
          <View style={{
            marginTop: 12, paddingHorizontal: 12, paddingVertical: 4,
            backgroundColor: colors.goldBg, borderRadius: 20,
            borderWidth: 1, borderColor: colors.gold + '40',
          }}>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 11, color: colors.gold, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {profile?.subscription === 'premium' ? '✦ Premium' : 'Free Plan'}
            </Text>
          </View>
        </View>

        {/* ── Preferences ───────────────────────────── */}
        <Section title="Preferences">
          <Row
            icon="cash-outline"
            label="Currency"
            value={`${currMeta?.flag ?? ''} ${currency}`}
            onPress={() => setShowCurrency(true)}
          />
          <Row
            icon="moon-outline"
            label="Dark mode"
            last
            trailing={
              <Switch
                value={isDark}
                onValueChange={(v) => setColorMode(v ? 'dark' : 'light')}
                trackColor={{ false: colors.border, true: colors.burgundy }}
                thumbColor={isDark ? colors.gold : colors.card}
              />
            }
          />
        </Section>

        {/* ── Security & Notifications ──────────────── */}
        <Section title="Security & Notifications">
          <Row
            icon="notifications-outline"
            label="Budget reminders"
            trailing={
              <Switch
                value={notificationsOn}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: colors.border, true: colors.burgundy }}
                thumbColor={notificationsOn ? colors.gold : colors.card}
              />
            }
          />
          {biometricAvailable ? (
            <Row
              icon="finger-print-outline"
              label="Biometric app lock"
              last
              trailing={
                <Switch
                  value={biometricOn}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: colors.border, true: colors.burgundy }}
                  thumbColor={biometricOn ? colors.gold : colors.card}
                />
              }
            />
          ) : (
            <Row
              icon="finger-print-outline"
              label="Biometric lock"
              value="Not available"
              last
            />
          )}
        </Section>

        {/* ── Account ───────────────────────────────── */}
        <Section title="Account">
          <Row
            icon="shield-checkmark-outline"
            label="Change Password"
            onPress={() => Alert.alert('Change Password', 'A password reset link will be sent to your email.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Send Link', onPress: async () => {
                if (user?.email) await supabase.auth.resetPasswordForEmail(user.email);
                Alert.alert('Sent ✓', 'Check your inbox for the reset link.');
              }},
            ])}
          />
          <Row icon="information-circle-outline" label="App Version" value={APP_VERSION} last />
        </Section>

        {/* ── Danger Zone ───────────────────────────── */}
        <Section title="Session">
          <Row
            icon="log-out-outline"
            label={signingOut ? 'Signing out…' : 'Sign Out'}
            onPress={signingOut ? undefined : handleSignOut}
            danger
            last
          />
        </Section>

      </ScrollView>

      {/* Currency picker overlay */}
      <CurrencyPicker
        visible={showCurrency}
        current={currency}
        onSelect={setCurrency}
        onClose={() => setShowCurrency(false)}
      />
    </SafeAreaView>
  );
}
