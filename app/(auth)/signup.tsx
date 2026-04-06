import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/utils/supabase';
import { signInWithGoogle, signInWithApple } from '@/utils/oAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

export default function SignupScreen() {
  const { colors, isDark, toggleColorMode } = useTheme();

  // ── Form state ────────────────────────────────────────────────────────────────
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading]   = useState(false);
  const [resending, setResending]       = useState(false);
  const [confirmed, setConfirmed]     = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused]     = useState(false);

  const emailRef = useRef<TextInput>(null);
  const pwRef    = useRef<TextInput>(null);

  // ── Entrance animation values ─────────────────────────────────────────────────
  const ringsEntrance = useRef(new Animated.Value(0)).current;
  const heroEntrance  = useRef(new Animated.Value(0)).current;
  const formEntrance  = useRef(new Animated.Value(0)).current;

  // ── Continuous ring pulse ─────────────────────────────────────────────────────
  const ringPulse = useRef(new Animated.Value(1)).current;

  // ── Input border animations ───────────────────────────────────────────────────
  const nameBorderAnim  = useRef(new Animated.Value(0)).current;
  const emailBorderAnim = useRef(new Animated.Value(0)).current;
  const pwBorderAnim    = useRef(new Animated.Value(0)).current;

  // ── Button press scale ────────────────────────────────────────────────────────
  const btnScale = useRef(new Animated.Value(1)).current;

  // ── Theme-toggle entrance ─────────────────────────────────────────────────────
  const themeBtnAnim = useRef(new Animated.Value(0)).current;

  // ── Strength bars fade ────────────────────────────────────────────────────────
  const strengthFade = useRef(new Animated.Value(0)).current;
  const prevPwLen = useRef(0);

  useEffect(() => {
    // Staggered entrance sequence
    Animated.stagger(120, [
      Animated.spring(ringsEntrance, {
        toValue: 1, tension: 55, friction: 9, useNativeDriver: true,
      }),
      Animated.timing(heroEntrance, {
        toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(formEntrance, {
        toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();

    // Ambient ring pulse loop (emerald-tinted inner ring differentiates from login)
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1.045,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 1.0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Theme-btn fade in after rest of entrance
    Animated.timing(themeBtnAnim, {
      toValue: 1, duration: 800, delay: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  // Fade strength bars in when password first typed, out when cleared
  useEffect(() => {
    if (password.length > 0 && prevPwLen.current === 0) {
      Animated.timing(strengthFade, {
        toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    } else if (password.length === 0 && prevPwLen.current > 0) {
      Animated.timing(strengthFade, {
        toValue: 0, duration: 180, useNativeDriver: true,
      }).start();
    }
    prevPwLen.current = password.length;
  }, [password]);

  // ── Input border helpers ──────────────────────────────────────────────────────
  function onFocusBorder(anim: Animated.Value, setter: (v: boolean) => void) {
    setter(true);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
  }
  function onBlurBorder(anim: Animated.Value, setter: (v: boolean) => void) {
    setter(false);
    Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: false }).start();
  }

  // ── Button spring helpers ─────────────────────────────────────────────────────
  function pressIn() {
    Animated.spring(btnScale, { toValue: 0.965, tension: 220, friction: 10, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.spring(btnScale, { toValue: 1, tension: 220, friction: 10, useNativeDriver: true }).start();
  }

  // ── Auth handlers ─────────────────────────────────────────────────────────────
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
    if (!data.session) {
      setConfirmed(true);
    }
    // If session exists, AuthContext handles redirect automatically
  }

  async function handleGoogle() {
    try {
      setGoogleLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Google Sign-In Failed', e?.message ?? 'Something went wrong.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleApple() {
    try {
      setAppleLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signInWithApple();
    } catch (e: any) {
      Alert.alert('Apple Sign-In Failed', e?.message ?? 'Something went wrong.');
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setResending(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Sent!', 'Another confirmation email is on its way.');
  }

  // ── Password strength ─────────────────────────────────────────────────────────
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
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  // ── Derived animated values ───────────────────────────────────────────────────
  const ringsScale = ringsEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const heroSlide  = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });
  const formSlide  = formEntrance.interpolate({ inputRange: [0, 1], outputRange: [44, 0] });

  const nameBorderColor  = nameBorderAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.gold] });
  const emailBorderColor = emailBorderAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.gold] });
  const pwBorderColor    = pwBorderAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.gold] });

  // ── Theme-aware tokens ────────────────────────────────────────────────────────
  const ctaGradient: [string, string] = isDark
    ? ['#ebc076', '#b18b46']
    : ['#c89b3c', '#8a5f18'];
  const ctaTextColor = isDark ? '#271900' : '#fff8ee';

  const glowGold    = isDark ? 'rgba(235,192,118,0.07)' : 'rgba(235,192,118,0.20)';
  const glowEmerald = isDark ? 'rgba(16,185,122,0.05)'  : 'rgba(16,185,122,0.10)';
  const glowAccent  = isDark ? 'rgba(235,192,118,0.04)' : 'rgba(235,192,118,0.14)';

  const r1Color = colors.emerald + (isDark ? '28' : '38');
  const r2Color = colors.emerald + (isDark ? '16' : '22');
  const r3Color = colors.gold    + (isDark ? '0e' : '15');

  const s = StyleSheet.create({
    safe:   { flex: 1, backgroundColor: colors.bg },
    kav:    { flex: 1 },
    scroll: { flexGrow: 1 },

    // ── Ambient glow layers ────────────────────────────────────────────────────
    glowTL: {
      position: 'absolute', width: 320, height: 320, borderRadius: 160,
      backgroundColor: glowGold,
      top: 0, left: 0,
      transform: [{ translateX: -110 }, { translateY: -110 }],
    },
    glowTR: {
      position: 'absolute', width: 200, height: 200, borderRadius: 100,
      backgroundColor: glowEmerald,
      top: SCREEN_H * 0.06, right: 0,
      transform: [{ translateX: 60 }],
    },
    glowBR: {
      position: 'absolute', width: 240, height: 240, borderRadius: 120,
      backgroundColor: glowAccent,
      bottom: 0, right: 0,
      transform: [{ translateX: 80 }, { translateY: 80 }],
    },

    // ── Header section ─────────────────────────────────────────────────────────
    deco: {
      height: SCREEN_H * 0.38,
      alignItems: 'center', justifyContent: 'center',
    },

    // ── Theme toggle ───────────────────────────────────────────────────────────
    themeBtn: {
      position: 'absolute', top: 16, right: 20,
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.goldBg,
      borderWidth: 1, borderColor: colors.gold + '38',
      alignItems: 'center', justifyContent: 'center',
    },

    // ── Rings ──────────────────────────────────────────────────────────────────
    ring: { position: 'absolute', borderRadius: 9999, borderWidth: 1 },
    r1:   { width: 160, height: 160, borderColor: r1Color },
    r2:   { width: 280, height: 280, borderColor: r2Color },
    r3:   { width: 408, height: 408, borderColor: r3Color },

    centerDot: {
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: colors.emerald + '80',
      position: 'absolute',
    },

    // ── Hero text ──────────────────────────────────────────────────────────────
    heroWrap: { alignItems: 'center', position: 'absolute' },
    wordmark: {
      fontFamily: FONTS.semibold, fontSize: 11,
      color: colors.gold, letterSpacing: 9,
      textTransform: 'uppercase', marginBottom: 6,
    },
    vaultHeading: {
      fontFamily: FONTS.headingItalic, fontSize: 42,
      color: colors.textPrimary, marginTop: 4,
      textAlign: 'center', lineHeight: 50,
    },
    tagline: {
      fontFamily: FONTS.regular, fontSize: 13,
      color: colors.textMuted, marginTop: 10,
      textAlign: 'center', letterSpacing: 0.4,
    },

    // ── Tab switcher ───────────────────────────────────────────────────────────
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: 28, gap: 28, marginBottom: 26,
    },
    tabActiveText: {
      fontFamily: FONTS.heading, fontSize: 22,
      color: colors.textPrimary,
    },
    tabActiveUnderline: {
      height: 2.5, backgroundColor: colors.gold,
      borderRadius: 2, marginTop: 5,
    },
    tabInactiveText: {
      fontFamily: FONTS.heading, fontSize: 22,
      color: colors.textMuted, opacity: 0.45,
    },

    // ── Card ───────────────────────────────────────────────────────────────────
    card: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 32, borderTopRightRadius: 32,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border,
      borderBottomWidth: 0,
      paddingHorizontal: 28, paddingTop: 36, paddingBottom: 52,
      flex: 1,
      ...(isDark ? {} : {
        shadowColor: '#1c1c18',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.09, shadowRadius: 24, elevation: 10,
      }),
    },

    // ── Field label ────────────────────────────────────────────────────────────
    fieldLabel: {
      fontFamily: FONTS.medium, fontSize: 10,
      color: colors.textMuted, letterSpacing: 2.2,
      textTransform: 'uppercase', marginBottom: 12,
    },

    // ── Field row ──────────────────────────────────────────────────────────────
    fieldRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingBottom: 12, marginBottom: 26, gap: 12,
    },
    fieldInput: {
      flex: 1, fontFamily: FONTS.medium,
      fontSize: 15, color: colors.textPrimary,
      paddingVertical: 0,
    },

    // ── Strength bars ──────────────────────────────────────────────────────────
    strengthWrap: {
      marginTop: -16, marginBottom: 22,
    },
    strengthRow: { flexDirection: 'row', gap: 5, marginBottom: 6 },
    strengthBar:  { flex: 1, height: 3, borderRadius: 2 },
    strengthLabel: {
      fontFamily: FONTS.medium, fontSize: 10,
      letterSpacing: 1.5, textTransform: 'uppercase',
    },

    // ── Divider ────────────────────────────────────────────────────────────────
    dividerRow: {
      flexDirection: 'row', alignItems: 'center',
      marginVertical: 26,
    },
    dividerLine:  { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: {
      fontFamily: FONTS.medium, fontSize: 9,
      color: colors.textMuted, letterSpacing: 3.5,
      opacity: 0.45, marginHorizontal: 10, textTransform: 'uppercase',
    },

    // ── Social buttons ─────────────────────────────────────────────────────────
    socialRow: { flexDirection: 'row', gap: 12 },
    socialBtn: {
      flex: 1, height: 50, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 8,
      backgroundColor: isDark ? 'transparent' : colors.surface,
    },
    socialBtnText: {
      fontFamily: FONTS.medium, fontSize: 12,
      letterSpacing: 1.4, color: colors.textMuted,
    },

    // ── Footer ─────────────────────────────────────────────────────────────────
    footer: {
      fontFamily: FONTS.regular, fontSize: 10,
      color: colors.textMuted, textAlign: 'center',
      marginTop: 36, letterSpacing: 0.5,
      opacity: 0.4, lineHeight: 17,
    },

    // ── Confirmation screen ────────────────────────────────────────────────────
    confirmWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 32, paddingBottom: 40,
    },
    envelopeRing: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: colors.goldBg,
      borderWidth: 1.5, borderColor: colors.gold + '45',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 30,
    },
    confirmTitle: {
      fontFamily: FONTS.headingItalic, fontSize: 34,
      color: colors.textPrimary, textAlign: 'center', marginBottom: 14,
      lineHeight: 42,
    },
    confirmBody: {
      fontFamily: FONTS.regular, fontSize: 14,
      color: colors.textSecondary, textAlign: 'center',
      lineHeight: 22, marginBottom: 8,
    },
    confirmEmail: { fontFamily: FONTS.semibold, color: colors.gold },
    confirmNote: {
      fontFamily: FONTS.regular, fontSize: 12,
      color: colors.textMuted, textAlign: 'center',
      lineHeight: 19, marginBottom: 38,
    },
    resendBtn: {
      borderWidth: 1.5, borderColor: colors.gold,
      borderRadius: 16, height: 58,
      alignItems: 'center', justifyContent: 'center',
      width: '100%', marginBottom: 14,
      backgroundColor: colors.goldBg,
    },
    resendText: {
      fontFamily: FONTS.semibold, fontSize: 12,
      color: colors.gold, letterSpacing: 2.5,
    },
    backBtn: { height: 50, alignItems: 'center', justifyContent: 'center' },
    backText: {
      fontFamily: FONTS.medium, fontSize: 14,
      color: colors.textMuted,
    },
  });

  // ── Confirmation pending screen ───────────────────────────────────────────────
  if (confirmed) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={s.glowTL} />
          <View style={s.glowBR} />
        </View>

        <View style={s.deco}>
          <TouchableOpacity style={s.themeBtn} onPress={toggleColorMode} activeOpacity={0.75}>
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={17} color={colors.gold} />
          </TouchableOpacity>
          <View style={[s.ring, s.r3]} />
          <View style={[s.ring, s.r2]} />
          <View style={[s.ring, s.r1]} />
          <View style={s.centerDot} />
          <View style={s.heroWrap}>
            <Text style={s.wordmark}>Steward</Text>
            <Text style={s.tagline}>Give every naira a purpose.</Text>
          </View>
        </View>

        <View style={[s.card, s.confirmWrap]}>
          <View style={s.envelopeRing}>
            <Ionicons name="mail-outline" size={40} color={colors.gold} />
          </View>

          <Text style={s.confirmTitle}>Check your inbox.</Text>
          <Text style={s.confirmBody}>
            We sent a confirmation link to{'\n'}
            <Text style={s.confirmEmail}>{email.trim()}</Text>
          </Text>
          <Text style={s.confirmNote}>
            Tap the link in that email to activate your account.{'\n'}
            Be sure to check your spam folder too.
          </Text>

          <TouchableOpacity
            style={s.resendBtn}
            onPress={handleResend}
            disabled={resending}
            activeOpacity={0.8}
          >
            {resending ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <Text style={s.resendText}>RESEND CONFIRMATION</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.replace('/(auth)/login' as any)}
            activeOpacity={0.7}
          >
            <Text style={s.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Signup form ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Ambient glow background ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={s.glowTL} />
        <View style={s.glowTR} />
        <View style={s.glowBR} />
      </View>

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── HERO SECTION ── */}
          <View style={s.deco}>

            {/* Theme toggle */}
            <Animated.View style={{ opacity: themeBtnAnim, position: 'absolute', top: 16, right: 20, zIndex: 10 }}>
              <TouchableOpacity style={s.themeBtn} onPress={toggleColorMode} activeOpacity={0.75}>
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={17}
                  color={colors.gold}
                />
              </TouchableOpacity>
            </Animated.View>

            {/* Pulsing concentric rings — emerald accent differentiates from login */}
            <Animated.View
              style={{
                alignItems: 'center', justifyContent: 'center',
                opacity: ringsEntrance,
                transform: [{ scale: ringsScale }],
              }}
            >
              <Animated.View style={[s.ring, s.r3, { transform: [{ scale: ringPulse }] }]} />
              <Animated.View style={[s.ring, s.r2, { transform: [{ scale: ringPulse }] }]} />
              <View style={[s.ring, s.r1]} />
              <View style={s.centerDot} />
            </Animated.View>

            {/* Hero text */}
            <Animated.View
              style={[
                s.heroWrap,
                {
                  opacity: heroEntrance,
                  transform: [{ translateY: heroSlide }],
                },
              ]}
            >
              <Text style={s.wordmark}>Steward</Text>
              <Text style={s.vaultHeading}>Join the House.</Text>
              <Text style={s.tagline}>Give every naira a purpose.</Text>
            </Animated.View>

          </View>

          {/* ── FORM SECTION ── */}
          <Animated.View
            style={{
              opacity: formEntrance,
              transform: [{ translateY: formSlide }],
            }}
          >
            {/* Tab switcher */}
            <View style={s.tabRow}>
              <TouchableOpacity
                onPress={() => router.replace('/(auth)/login' as any)}
                activeOpacity={0.7}
              >
                <Text style={s.tabInactiveText}>Login</Text>
              </TouchableOpacity>
              <View>
                <Text style={s.tabActiveText}>Join the House</Text>
                <View style={s.tabActiveUnderline} />
              </View>
            </View>

            {/* Form card */}
            <View style={s.card}>

              {/* ── Full Name ── */}
              <Text style={s.fieldLabel}>Full Name</Text>
              <Animated.View
                style={[
                  s.fieldRow,
                  { borderBottomWidth: 1.5, borderBottomColor: nameBorderColor },
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
                  onFocus={() => onFocusBorder(nameBorderAnim, setNameFocused)}
                  onBlur={() => onBlurBorder(nameBorderAnim, setNameFocused)}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </Animated.View>

              {/* ── Email ── */}
              <Text style={s.fieldLabel}>Identity (Email)</Text>
              <Animated.View
                style={[
                  s.fieldRow,
                  { borderBottomWidth: 1.5, borderBottomColor: emailBorderColor },
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
                  onFocus={() => onFocusBorder(emailBorderAnim, setEmailFocused)}
                  onBlur={() => onBlurBorder(emailBorderAnim, setEmailFocused)}
                  onSubmitEditing={() => pwRef.current?.focus()}
                />
              </Animated.View>

              {/* ── Passcode ── */}
              <Text style={s.fieldLabel}>Passcode</Text>
              <Animated.View
                style={[
                  s.fieldRow,
                  {
                    borderBottomWidth: 1.5,
                    borderBottomColor: pwBorderColor,
                    ...(password.length > 0 ? { marginBottom: 8 } : {}),
                  },
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
                  onFocus={() => onFocusBorder(pwBorderAnim, setPwFocused)}
                  onBlur={() => onBlurBorder(pwBorderAnim, setPwFocused)}
                  onSubmitEditing={handleSignup}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} activeOpacity={0.7}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={pwFocused ? colors.gold : colors.textMuted}
                  />
                </TouchableOpacity>
              </Animated.View>

              {/* ── Strength bars (fade in/out) ── */}
              <Animated.View style={[s.strengthWrap, { opacity: strengthFade }]}>
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
                {pwStrength > 0 && (
                  <Text
                    style={[
                      s.strengthLabel,
                      { color: strengthColors[pwStrength], textAlign: 'right' },
                    ]}
                  >
                    {strengthLabels[pwStrength]}
                  </Text>
                )}
              </Animated.View>

              {/* ── CTA button ── */}
              <Animated.View
                style={{
                  marginTop: 28,
                  borderRadius: 18,
                  overflow: 'hidden',
                  transform: [{ scale: btnScale }],
                }}
              >
                <LinearGradient
                  colors={ctaGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 18 }}
                >
                  <TouchableOpacity
                    style={{ height: 62, alignItems: 'center', justifyContent: 'center' }}
                    onPress={handleSignup}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    disabled={loading}
                    activeOpacity={1}
                  >
                    {loading ? (
                      <ActivityIndicator color={ctaTextColor} />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name="home-outline" size={16} color={ctaTextColor} />
                        <Text
                          style={{
                            fontFamily: FONTS.semibold,
                            letterSpacing: 3.5,
                            fontSize: 12,
                            color: ctaTextColor,
                          }}
                        >
                          CREATE ACCOUNT
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              </Animated.View>

              {/* ── Divider ── */}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>External Keys</Text>
                <View style={s.dividerLine} />
              </View>

              {/* ── Social buttons ── */}
              <View style={s.socialRow}>
                <TouchableOpacity
                  style={s.socialBtn}
                  onPress={handleApple}
                  disabled={appleLoading || googleLoading || loading}
                  activeOpacity={0.75}
                >
                  {appleLoading ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={16} color={colors.textPrimary} />
                      <Text style={s.socialBtnText}>Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.socialBtn}
                  onPress={handleGoogle}
                  disabled={googleLoading || appleLoading || loading}
                  activeOpacity={0.75}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={16} color={colors.textPrimary} />
                      <Text style={s.socialBtnText}>Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* ── Footer ── */}
              <Text style={s.footer}>
                Strictly confidential · Access monitored by Steward Guardian AI
              </Text>

            </View>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
