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
import { Link, router } from 'expo-router';
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
  const [confirmed, setConfirmed] = useState(false); // show "check email" screen
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
    // If email confirmation is required, session is null but user is created
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

  // ─── Styles ────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    kav: { flex: 1 },
    scroll: { flexGrow: 1 },

    deco: {
      height: SCREEN_H * 0.28,
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
      fontFamily: FONTS.display,
      fontSize: 46,
      color: colors.gold,
      letterSpacing: -2,
      zIndex: 2,
    },
    tagline: {
      fontFamily: FONTS.headingItalic,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      zIndex: 2,
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

    card: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      paddingHorizontal: 28,
      paddingTop: 28,
      paddingBottom: 40,
      flex: 1,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: isDark ? 0 : 0.08,
      shadowRadius: 12,
      elevation: isDark ? 0 : 4,
    },
    cardTitle: {
      fontFamily: FONTS.heading,
      fontSize: 28,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    cardSubtitle: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
    },

    fieldLabel: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    fieldWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1.5,
      paddingBottom: 10,
      marginBottom: 20,
      gap: 10,
    },
    fieldInput: {
      flex: 1,
      fontFamily: FONTS.medium,
      fontSize: 15,
      color: colors.textPrimary,
      paddingVertical: 0,
    },

    strengthRow: { flexDirection: 'row', gap: 4, marginTop: -12, marginBottom: 20 },
    strengthBar: { flex: 1, height: 3, borderRadius: 2 },

    btn: {
      backgroundColor: colors.gold,
      borderRadius: 14,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    btnText: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: isDark ? colors.bg : '#FFFFFF',
    },
    loginRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    loginHint: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textMuted,
    },
    loginLink: {
      fontFamily: FONTS.semibold,
      fontSize: 13,
      color: colors.gold,
    },
    termsText: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 16,
    },
    termsLink: { color: colors.gold },

    // ── Confirmation screen ──────────────────────────────────
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
      borderWidth: 1,
      borderColor: colors.gold + '30',
    },
    confirmTitle: {
      fontFamily: FONTS.heading,
      fontSize: 26,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
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
      borderRadius: 14,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      marginBottom: 16,
    },
    resendText: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.gold,
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

  // ─── Confirmation pending screen ──────────────────────────────────────────
  if (confirmed) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
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
          <Text style={s.tagline}>Your personal financial OS</Text>
        </View>

        <View style={[s.card, s.confirmWrap]}>
          <View style={s.envelopeCircle}>
            <Ionicons name="mail-outline" size={40} color={colors.gold} />
          </View>

          <Text style={s.confirmTitle}>Check your inbox</Text>
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
            {resending
              ? <ActivityIndicator color={colors.gold} />
              : <Text style={s.resendText}>Resend confirmation email</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.backBtn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Signup form ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* ── Deco ─────────────────────────────────────── */}
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
            <Text style={s.tagline}>Your personal financial OS</Text>
          </View>

          {/* ── Card ─────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Create account</Text>
            <Text style={s.cardSubtitle}>Free forever · No bank link required</Text>

            {/* Name */}
            <Text style={s.fieldLabel}>Full name</Text>
            <View style={[s.fieldWrap, { borderBottomColor: nameFocused ? colors.gold : colors.border }]}>
              <Ionicons name="person-outline" size={18} color={nameFocused ? colors.gold : colors.textMuted} />
              <TextInput
                style={s.fieldInput}
                placeholder="Andrew Steward"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>

            {/* Email */}
            <Text style={s.fieldLabel}>Email address</Text>
            <View style={[s.fieldWrap, { borderBottomColor: emailFocused ? colors.gold : colors.border }]}>
              <Ionicons name="mail-outline" size={18} color={emailFocused ? colors.gold : colors.textMuted} />
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
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                onSubmitEditing={() => pwRef.current?.focus()}
              />
            </View>

            {/* Password */}
            <Text style={s.fieldLabel}>Password</Text>
            <View style={[s.fieldWrap, { borderBottomColor: pwFocused ? colors.gold : colors.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={pwFocused ? colors.gold : colors.textMuted} />
              <TextInput
                ref={pwRef}
                style={s.fieldInput}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                onSubmitEditing={handleSignup}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={colors.textMuted}
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

            <TouchableOpacity
              style={s.btn}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} />
                : <Text style={s.btnText}>Create Account</Text>
              }
            </TouchableOpacity>

            <View style={s.loginRow}>
              <Text style={s.loginHint}>Already have an account?</Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={s.loginLink}>Sign in</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <Text style={s.termsText}>
              By signing up you agree to our{' '}
              <Text style={s.termsLink}>Terms of Service</Text> and{' '}
              <Text style={s.termsLink}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
