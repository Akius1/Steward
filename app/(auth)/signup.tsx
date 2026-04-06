import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

export default function SignupScreen() {
  const { colors, isDark, toggleColorMode } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Sign Up Failed', error.message);
      return;
    }
    if (data.session) {
      // Email confirmation disabled — session is live, AuthContext will redirect
    } else {
      // Email confirmation required — show "check inbox" screen
      setConfirmed(true);
    }
  }

  async function handleResend() {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setResending(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Sent!', 'Another confirmation email is on its way.');
    }
  }

  // Password strength
  const pwStrength =
    password.length === 0 ? 0 :
    password.length < 6   ? 1 :
    password.length < 10  ? 2 :
    /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;

  const strengthColors = [
    colors.border,
    colors.danger,
    colors.warning,
    colors.gold,
    colors.success,
  ];

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#121415' },
    kav: { flex: 1 },
    scroll: { flexGrow: 1 },

    // ── Ambient glow ──────────────────────────────────────
    glowTopLeft: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: 'rgba(235,192,118,0.06)',
      top: 0,
      left: 0,
      transform: [{ translateX: -80 }, { translateY: -80 }],
    },
    glowBottomRight: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: 'rgba(185,203,193,0.04)',
      bottom: 0,
      right: 0,
      transform: [{ translateX: 70 }, { translateY: 70 }],
    },

    // ── Decorative header ────────────────────────────────
    deco: {
      height: SCREEN_H * 0.35,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeBtn: {
      position: 'absolute',
      top: 16,
      right: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.goldBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ring: {
      position: 'absolute',
      borderRadius: 9999,
      borderWidth: 1,
    },
    r1: { width: 160, height: 160, borderColor: colors.emerald + '20' },
    r2: { width: 280, height: 280, borderColor: colors.emerald + '12' },
    r3: { width: 400, height: 400, borderColor: colors.gold + '08' },
    wordmark: {
      fontFamily: FONTS.semibold,
      fontSize: 22,
      color: colors.gold,
      letterSpacing: 6,
      textTransform: 'uppercase',
      zIndex: 2,
    },
    vaultHeading: {
      fontFamily: FONTS.headingItalic,
      fontSize: 36,
      color: colors.textPrimary,
      marginTop: 12,
      textAlign: 'center',
      zIndex: 2,
    },
    tagline: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 6,
      zIndex: 2,
      textAlign: 'center',
    },

    // ── Tab switcher ─────────────────────────────────────
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: 28,
      gap: 32,
      marginBottom: 32,
    },
    tabActiveText: {
      fontFamily: FONTS.heading,
      fontSize: 20,
      color: colors.textPrimary,
    },
    tabActiveUnderline: {
      height: 2,
      backgroundColor: colors.gold,
      borderRadius: 1,
      marginTop: 6,
    },
    tabInactiveText: {
      fontFamily: FONTS.heading,
      fontSize: 20,
      color: colors.textMuted,
      opacity: 0.45,
    },

    // ── Card ─────────────────────────────────────────────
    card: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomWidth: 0,
      paddingHorizontal: 28,
      paddingTop: 36,
      paddingBottom: 48,
      flex: 1,
    },

    // ── Field label ───────────────────────────────────────
    fieldLabel: {
      fontFamily: FONTS.medium,
      fontSize: 10,
      color: colors.textMuted,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 10,
    },

    // ── Bottom-border field ───────────────────────────────
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 14,
      marginBottom: 28,
      gap: 12,
    },
    fieldInput: {
      flex: 1,
      fontFamily: FONTS.medium,
      fontSize: 15,
      color: colors.textPrimary,
      paddingVertical: 0,
    },

    // ── Strength bars ─────────────────────────────────────
    strengthRow: { flexDirection: 'row', gap: 4, marginTop: -18, marginBottom: 22 },
    strengthBar: { flex: 1, height: 3, borderRadius: 2 },

    // ── Divider ───────────────────────────────────────────
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 28,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontFamily: FONTS.medium,
      fontSize: 10,
      color: colors.textMuted,
      letterSpacing: 3,
      opacity: 0.5,
      marginHorizontal: 8,
    },

    // ── Social placeholder buttons ────────────────────────
    socialRow: {
      flexDirection: 'row',
      gap: 12,
    },
    socialBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    socialBtnText: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      letterSpacing: 2,
      color: colors.textMuted,
    },

    // ── Footer ────────────────────────────────────────────
    footer: {
      fontFamily: FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 36,
      letterSpacing: 0.5,
      opacity: 0.5,
      lineHeight: 16,
    },

    // ── Confirmation screen ───────────────────────────────
    confirmWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingBottom: 40,
    },
    envelopeCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.goldBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
      borderWidth: 1.5,
      borderColor: colors.gold + '40',
    },
    confirmTitle: {
      fontFamily: FONTS.headingItalic,
      fontSize: 32,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 16,
    },
    confirmBody: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 8,
    },
    confirmEmail: {
      fontFamily: FONTS.semibold,
      color: colors.gold,
    },
    confirmNote: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 36,
    },
    resendBtn: {
      borderWidth: 1.5,
      borderColor: colors.gold,
      borderRadius: 16,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      marginBottom: 16,
    },
    resendText: {
      fontFamily: FONTS.semibold,
      fontSize: 13,
      color: colors.gold,
      letterSpacing: 1,
    },
    backBtn: {
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backText: {
      fontFamily: FONTS.medium,
      fontSize: 14,
      color: colors.textMuted,
    },
  });

  // ── Confirmation pending screen ─────────────────────────────────────────────
  if (confirmed) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />

        {/* Ambient glow background */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={s.glowTopLeft} />
          <View style={s.glowBottomRight} />
        </View>

        <View style={s.deco}>
          <TouchableOpacity style={s.themeBtn} onPress={toggleColorMode}>
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={colors.gold}
            />
          </TouchableOpacity>
          <View style={[s.ring, s.r3]} />
          <View style={[s.ring, s.r2]} />
          <View style={[s.ring, s.r1]} />
          <Text style={s.wordmark}>Steward</Text>
          <Text style={s.tagline}>Give every naira a purpose.</Text>
        </View>

        <View style={[s.card, s.confirmWrap]}>
          <View style={s.envelopeCircle}>
            <Ionicons name="mail-outline" size={40} color={colors.gold} />
          </View>

          <Text style={s.confirmTitle}>Check your inbox.</Text>
          <Text style={s.confirmBody}>
            We sent a confirmation link to{'\n'}
            <Text style={s.confirmEmail}>{email.trim()}</Text>
          </Text>
          <Text style={s.confirmNote}>
            Click the link in that email to activate your account.{'\n'}
            Be sure to check your spam folder too.
          </Text>

          <TouchableOpacity
            style={s.resendBtn}
            onPress={handleResend}
            disabled={resending}
          >
            {resending ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <Text style={s.resendText}>RESEND CONFIRMATION</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.backBtn} onPress={() => router.replace('/(auth)/login' as any)}>
            <Text style={s.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Signup form ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />

      {/* Ambient glow background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={s.glowTopLeft} />
        <View style={s.glowBottomRight} />
      </View>

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Wordmark section */}
          <View style={s.deco}>
            <TouchableOpacity style={s.themeBtn} onPress={toggleColorMode}>
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={colors.gold}
              />
            </TouchableOpacity>
            <View style={[s.ring, s.r3]} />
            <View style={[s.ring, s.r2]} />
            <View style={[s.ring, s.r1]} />
            <Text style={s.wordmark}>Steward</Text>
            <Text style={s.vaultHeading}>Join the House.</Text>
            <Text style={s.tagline}>Give every naira a purpose.</Text>
          </View>

          {/* Tab switcher */}
          <View style={s.tabRow}>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login' as any)}>
              <Text style={s.tabInactiveText}>Login</Text>
            </TouchableOpacity>
            <View>
              <Text style={s.tabActiveText}>Join the House</Text>
              <View style={s.tabActiveUnderline} />
            </View>
          </View>

          {/* Form card */}
          <View style={s.card}>

            {/* Full Name field */}
            <Text style={s.fieldLabel}>Full Name</Text>
            <View
              style={[
                s.fieldRow,
                {
                  borderBottomWidth: 1.5,
                  borderBottomColor: nameFocused ? colors.gold : colors.border,
                },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={nameFocused ? colors.gold : colors.textMuted}
              />
              <TextInput
                style={s.fieldInput}
                placeholder="Andrew Steward"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                cursorColor={colors.gold}
                selectionColor={colors.gold + '44'}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>

            {/* Email field */}
            <Text style={s.fieldLabel}>Identity (Email)</Text>
            <View
              style={[
                s.fieldRow,
                {
                  borderBottomWidth: 1.5,
                  borderBottomColor: emailFocused ? colors.gold : colors.border,
                },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={emailFocused ? colors.gold : colors.textMuted}
              />
              <TextInput
                ref={emailRef}
                style={s.fieldInput}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                cursorColor={colors.gold}
                selectionColor={colors.gold + '44'}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                onSubmitEditing={() => pwRef.current?.focus()}
              />
            </View>

            {/* Password field */}
            <Text style={s.fieldLabel}>Passcode</Text>
            <View
              style={[
                s.fieldRow,
                {
                  borderBottomWidth: 1.5,
                  borderBottomColor: pwFocused ? colors.gold : colors.border,
                },
                password.length > 0 && { marginBottom: 8 },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={pwFocused ? colors.gold : colors.textMuted}
              />
              <TextInput
                ref={pwRef}
                style={s.fieldInput}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                cursorColor={colors.gold}
                selectionColor={colors.gold + '44'}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                onSubmitEditing={handleSignup}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={pwFocused ? colors.gold : colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Strength bars */}
            {password.length > 0 && (
              <View style={s.strengthRow}>
                {[1, 2, 3, 4].map((level) => (
                  <View
                    key={level}
                    style={[
                      s.strengthBar,
                      { backgroundColor: pwStrength >= level ? strengthColors[pwStrength] : colors.border },
                    ]}
                  />
                ))}
              </View>
            )}

            {/* CTA button */}
            <LinearGradient
              colors={['#ebc076', '#b18b46']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 16, marginTop: 32, overflow: 'hidden' }}
            >
              <TouchableOpacity
                style={{ height: 60, alignItems: 'center', justifyContent: 'center' }}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#271900" />
                ) : (
                  <Text
                    style={{
                      fontFamily: FONTS.semibold,
                      letterSpacing: 3,
                      fontSize: 13,
                      color: '#271900',
                    }}
                  >
                    CREATE ACCOUNT
                  </Text>
                )}
              </TouchableOpacity>
            </LinearGradient>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>External Keys</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Social placeholder buttons */}
            <View style={s.socialRow}>
              <View style={s.socialBtn}>
                <Text style={s.socialBtnText}>Apple ID</Text>
              </View>
              <View style={s.socialBtn}>
                <Text style={s.socialBtnText}>Google</Text>
              </View>
            </View>

            {/* Footer */}
            <Text style={s.footer}>
              Strictly confidential · Access monitored by Steward Guardian AI
            </Text>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
