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
import { Link } from 'expo-router';
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
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    }
    // On success, AuthContext picks up the session and the root layout redirects to (tabs)
  }

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    kav: { flex: 1 },
    scroll: { flexGrow: 1 },

    deco: {
      height: SCREEN_H * 0.32,
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

    // Password strength
    strengthRow: { flexDirection: 'row', gap: 4, marginTop: -12, marginBottom: 20 },
    strengthBar: { flex: 1, height: 3, borderRadius: 2 },

    signUpBtn: {
      backgroundColor: colors.gold,
      borderRadius: 14,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    signUpText: {
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
  });

  // Password strength indicator
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
            <View
              style={[
                s.fieldWrap,
                { borderBottomColor: nameFocused ? colors.gold : colors.border },
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
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>

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

            {/* Password strength bars */}
            {password.length > 0 && (
              <View style={s.strengthRow}>
                {[1, 2, 3, 4].map((level) => (
                  <View
                    key={level}
                    style={[
                      s.strengthBar,
                      {
                        backgroundColor:
                          pwStrength >= level
                            ? strengthColors[pwStrength]
                            : colors.border,
                      },
                    ]}
                  />
                ))}
              </View>
            )}

            <TouchableOpacity
              style={s.signUpBtn}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={isDark ? colors.bg : '#FFF'} />
              ) : (
                <Text style={s.signUpText}>Create Account</Text>
              )}
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
