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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/utils/supabase';
import { signInWithGoogle, signInWithApple } from '@/utils/oAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

export default function LoginScreen() {
  const { colors, isDark, toggleColorMode } = useTheme();
  const router = useRouter();

  // ── Form state ────────────────────────────────────────────────────────────────
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailFocused, setEmailFocused]   = useState(false);
  const [pwFocused, setPwFocused]         = useState(false);
  const pwRef = useRef<TextInput>(null);

  // ── Entrance animation values ─────────────────────────────────────────────────
  const ringsEntrance = useRef(new Animated.Value(0)).current;
  const heroEntrance  = useRef(new Animated.Value(0)).current;
  const formEntrance  = useRef(new Animated.Value(0)).current;

  // ── Continuous ring pulse ─────────────────────────────────────────────────────
  const ringPulse = useRef(new Animated.Value(1)).current;

  // ── Input border animations ───────────────────────────────────────────────────
  const emailBorderAnim = useRef(new Animated.Value(0)).current;
  const pwBorderAnim    = useRef(new Animated.Value(0)).current;

  // ── Button press scale ────────────────────────────────────────────────────────
  const btnScale = useRef(new Animated.Value(1)).current;

  // ── Theme-toggle button tint ──────────────────────────────────────────────────
  const themeBtnAnim = useRef(new Animated.Value(0)).current;

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

    // Ambient ring pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1.045,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 1.0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle theme-btn entrance
    Animated.timing(themeBtnAnim, {
      toValue: 1, duration: 800, delay: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

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
  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Sign In Failed', error.message);
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

  function handleApple() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Coming Soon', 'Apple Sign-In will be available in a future update.');
  }

  // ── Derived animated values ───────────────────────────────────────────────────
  const ringsScale = ringsEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const heroSlide  = heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });
  const formSlide  = formEntrance.interpolate({ inputRange: [0, 1], outputRange: [44, 0] });

  const emailBorderColor = emailBorderAnim.interpolate({
    inputRange: [0, 1], outputRange: [colors.border, colors.gold],
  });
  const pwBorderColor = pwBorderAnim.interpolate({
    inputRange: [0, 1], outputRange: [colors.border, colors.gold],
  });

  // ── Theme-aware gradient stops ────────────────────────────────────────────────
  const ctaGradient: [string, string] = isDark
    ? ['#e9c349', '#aa890a']
    : ['#aa890a', '#735c00'];
  const ctaTextColor = isDark ? '#3c2f00' : '#ffe088';

  // ── Theme-aware glow colours ──────────────────────────────────────────────────
  const glowGold   = isDark ? 'rgba(233,195,73,0.09)'  : 'rgba(233,195,73,0.20)';
  const glowSage   = isDark ? 'rgba(93,23,21,0.18)'    : 'rgba(255,218,216,0.60)';
  const glowAccent = isDark ? 'rgba(233,195,73,0.05)'  : 'rgba(233,195,73,0.12)';

  // ── Ring border tokens ────────────────────────────────────────────────────────
  const r1Color = colors.gold + (isDark ? '2a' : '35');
  const r2Color = colors.gold + (isDark ? '18' : '22');
  const r3Color = colors.gold + (isDark ? '0e' : '15');

  const s = StyleSheet.create({
    safe:   { flex: 1, backgroundColor: colors.bg },
    kav:    { flex: 1 },
    scroll: { flexGrow: 1 },

    // ── Ambient glow layers ────────────────────────────────────────────────────
    glowTL: {
      position: 'absolute', width: 340, height: 340, borderRadius: 170,
      backgroundColor: glowGold,
      top: 0, left: 0,
      transform: [{ translateX: -110 }, { translateY: -110 }],
    },
    glowTR: {
      position: 'absolute', width: 220, height: 220, borderRadius: 110,
      backgroundColor: glowAccent,
      top: SCREEN_H * 0.08, right: 0,
      transform: [{ translateX: 70 }],
    },
    glowBR: {
      position: 'absolute', width: 260, height: 260, borderRadius: 130,
      backgroundColor: glowSage,
      bottom: 0, right: 0,
      transform: [{ translateX: 90 }, { translateY: 90 }],
    },

    // ── Decorative header ──────────────────────────────────────────────────────
    deco: {
      height: SCREEN_H * 0.40,
      alignItems: 'center',
      justifyContent: 'center',
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
    r1:   { width: 172, height: 172, borderColor: r1Color },
    r2:   { width: 292, height: 292, borderColor: r2Color },
    r3:   { width: 420, height: 420, borderColor: r3Color },

    // Center dot
    centerDot: {
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: colors.gold + '80',
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
      paddingHorizontal: 28,
      gap: 28,
      marginBottom: 26,
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

    // ── Field row (bottom-border style) ───────────────────────────────────────
    fieldRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingBottom: 12, marginBottom: 26, gap: 12,
    },
    fieldInput: {
      flex: 1, fontFamily: FONTS.medium,
      fontSize: 15, color: colors.textPrimary,
      paddingVertical: 0,
    },

    // ── Forgot row ─────────────────────────────────────────────────────────────
    forgotRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 10,
    },
    forgotText: {
      fontFamily: FONTS.regular, fontSize: 11,
      color: colors.gold, opacity: 0.75,
    },

    // ── Divider ────────────────────────────────────────────────────────────────
    dividerRow: {
      flexDirection: 'row', alignItems: 'center',
      marginVertical: 26,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: {
      fontFamily: FONTS.medium, fontSize: 9,
      color: colors.textMuted, letterSpacing: 3.5,
      opacity: 0.45, marginHorizontal: 10,
      textTransform: 'uppercase',
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
  });

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

            {/* Pulsing concentric rings */}
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

            {/* Hero text — slides up on entrance */}
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
              <Text style={s.vaultHeading}>Enter the Vault.</Text>
              <Text style={s.tagline}>Give every naira a purpose.</Text>
            </Animated.View>

          </View>

          {/* ── FORM SECTION (slides up) ── */}
          <Animated.View
            style={{
              opacity: formEntrance,
              transform: [{ translateY: formSlide }],
            }}
          >
            {/* Tab switcher */}
            <View style={s.tabRow}>
              <View>
                <Text style={s.tabActiveText}>Login</Text>
                <View style={s.tabActiveUnderline} />
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/signup' as any)}
                activeOpacity={0.7}
              >
                <Text style={s.tabInactiveText}>Join the House</Text>
              </TouchableOpacity>
            </View>

            {/* Form card */}
            <View style={s.card}>

              {/* ── Email field ── */}
              <Text style={s.fieldLabel}>Identity (Email)</Text>
              <Animated.View
                style={[
                  s.fieldRow,
                  {
                    borderBottomWidth: 1.5,
                    borderBottomColor: emailBorderColor,
                  },
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
                  cursorColor={colors.gold}
                  selectionColor={colors.gold + '44'}
                  onFocus={() => onFocusBorder(emailBorderAnim, setEmailFocused)}
                  onBlur={() => onBlurBorder(emailBorderAnim, setEmailFocused)}
                  onSubmitEditing={() => pwRef.current?.focus()}
                />
              </Animated.View>

              {/* ── Password field ── */}
              <View style={s.forgotRow}>
                <Text style={s.fieldLabel}>Passcode</Text>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={s.forgotText}>Forgot Access?</Text>
                </TouchableOpacity>
              </View>
              <Animated.View
                style={[
                  s.fieldRow,
                  {
                    borderBottomWidth: 1.5,
                    borderBottomColor: pwBorderColor,
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
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  cursorColor={colors.gold}
                  selectionColor={colors.gold + '44'}
                  onFocus={() => onFocusBorder(pwBorderAnim, setPwFocused)}
                  onBlur={() => onBlurBorder(pwBorderAnim, setPwFocused)}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={pwFocused ? colors.gold : colors.textMuted}
                  />
                </TouchableOpacity>
              </Animated.View>

              {/* ── CTA button with spring press ── */}
              <Animated.View
                style={{
                  marginTop: 38,
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
                    onPress={handleLogin}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    disabled={loading}
                    activeOpacity={1}
                  >
                    {loading ? (
                      <ActivityIndicator color={ctaTextColor} />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={ctaTextColor} />
                        <Text
                          style={{
                            fontFamily: FONTS.semibold,
                            letterSpacing: 3.5,
                            fontSize: 12,
                            color: ctaTextColor,
                          }}
                        >
                          ENTER VAULT
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
                  activeOpacity={0.75}
                >
                  <Ionicons name="logo-apple" size={16} color={colors.textPrimary} />
                  <Text style={s.socialBtnText}>Apple</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.socialBtn}
                  onPress={handleGoogle}
                  disabled={googleLoading || loading}
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
