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
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

export default function LoginScreen() {
  const { colors, isDark, toggleColorMode } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const pwRef = useRef<TextInput>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign In Failed', error.message);
    }
  }

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    kav: { flex: 1 },
    scroll: { flexGrow: 1 },

    // ── Decorative area ─────────────────────────────────
    deco: {
      height: SCREEN_H * 0.40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ring: {
      position: 'absolute',
      borderRadius: 9999,
      borderWidth: 1,
    },
    r1: { width: 180, height: 180, borderColor: colors.gold + '20' },
    r2: { width: 300, height: 300, borderColor: colors.gold + '12' },
    r3: { width: 420, height: 420, borderColor: colors.gold + '08' },
    wordmark: {
      fontFamily: FONTS.display,
      fontSize: 52,
      color: colors.gold,
      letterSpacing: -2,
      zIndex: 2,
    },
    tagline: {
      fontFamily: FONTS.headingItalic,
      fontSize: 14,
      color: colors.goldLight,
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

    // ── Card ────────────────────────────────────────────
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
      marginBottom: 28,
    },

    // ── Input fields ────────────────────────────────────
    fieldWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1.5,
      paddingBottom: 10,
      marginBottom: 22,
      gap: 10,
    },
    fieldInput: {
      flex: 1,
      fontFamily: FONTS.medium,
      fontSize: 15,
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    fieldLabel: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
    },

    forgotRow: {
      alignItems: 'flex-end',
      marginTop: -8,
      marginBottom: 28,
    },
    forgotText: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.gold,
    },

    // ── Buttons ─────────────────────────────────────────
    signInBtn: {
      backgroundColor: colors.gold,
      borderRadius: 14,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    signInText: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: isDark ? colors.bg : '#FFFFFF',
    },
    signUpRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    signUpHint: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textMuted,
    },
    signUpLink: {
      fontFamily: FONTS.semibold,
      fontSize: 13,
      color: colors.gold,
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* ── Decorative header ───────────────────────── */}
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

          {/* ── Form card ───────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Welcome back</Text>
            <Text style={s.cardSubtitle}>Sign in to your account</Text>

            {/* Email */}
            <Text style={s.fieldLabel}>Email address</Text>
            <View
              style={[
                s.fieldWrap,
                { borderBottomColor: emailFocused ? colors.gold : colors.border },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={emailFocused ? colors.gold : colors.textMuted}
              />
              <TextInput
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
            <View
              style={[
                s.fieldWrap,
                { borderBottomColor: pwFocused ? colors.gold : colors.border },
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
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <View style={s.forgotRow}>
              <TouchableOpacity>
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={s.signInBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={isDark ? colors.bg : '#FFF'} />
              ) : (
                <Text style={s.signInText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={s.signUpRow}>
              <Text style={s.signUpHint}>Don't have an account?</Text>
              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity>
                  <Text style={s.signUpLink}>Sign up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
