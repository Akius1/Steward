import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS, BUCKET_DEFAULTS } from '@/constants/theme';
import { fmt, formatInput, parseInput, CURRENCIES } from '@/utils/currency';
import type { IncomeType } from '@/types/database';

const { width: SCREEN_W } = Dimensions.get('window');

const TOTAL_STEPS = 5; // 1=Welcome, 2=Features, 3=Debt+Security, 4=Income, 5=Allocate

const INCOME_TYPES: IncomeType[] = ['SALARY', 'FREELANCE', 'BUSINESS', 'GIFT', 'SIDE INCOME'];
const TYPE_ICONS: Record<IncomeType, React.ComponentProps<typeof Ionicons>['name']> = {
  SALARY:        'briefcase-outline',
  FREELANCE:     'laptop-outline',
  BUSINESS:      'business-outline',
  GIFT:          'gift-outline',
  'SIDE INCOME': 'flash-outline',
};

// ─── Feature slides data ──────────────────────────────────────────────────────
const SLIDE_2_FEATURES = [
  {
    icon: 'sparkles-outline' as const,
    color: '#C9A84C',
    bgColor: '#C9A84C22',
    title: 'AI Financial Coach',
    desc: 'Ask anything about your money and get personalised advice based on your actual finances.',
  },
  {
    icon: 'bar-chart-outline' as const,
    color: '#4CAF90',
    bgColor: '#4CAF9022',
    title: 'Smart Budget Grades',
    desc: 'Get a monthly grade so you always know exactly how well you\'re sticking to your plan.',
  },
  {
    icon: 'pie-chart-outline' as const,
    color: '#7C9EFF',
    bgColor: '#7C9EFF22',
    title: 'Budget Buckets',
    desc: 'Allocate every naira across spending categories — needs, wants, savings, and more.',
  },
];

const SLIDE_3_FEATURES = [
  {
    icon: 'trending-down-outline' as const,
    color: '#FF7C7C',
    bgColor: '#FF7C7C22',
    title: 'Debt Payoff Planner',
    desc: 'Map out every debt and build a payoff plan. Watch balances shrink month by month.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    color: '#A78BFA',
    bgColor: '#A78BFA22',
    title: 'Biometric Security',
    desc: 'Lock the app with Face ID or fingerprint. Your financial data stays private.',
  },
  {
    icon: 'notifications-outline' as const,
    color: '#34D399',
    bgColor: '#34D39922',
    title: 'Smart Reminders',
    desc: 'Get nudged when it\'s time to log income, review your budget, or check in on goals.',
  },
];

// ─── Animated rings (Welcome screen) ─────────────────────────────────────────
function Rings({ colors, isDark }: { colors: any; isDark: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1, duration: 800,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const r1 = colors.gold + (isDark ? '2a' : '30');
  const r2 = colors.gold + (isDark ? '18' : '1e');
  const r3 = colors.gold + (isDark ? '0e' : '12');

  return (
    <Animated.View style={{
      alignItems: 'center', justifyContent: 'center',
      opacity: entrance,
      transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }],
    }}>
      <Animated.View style={[rs.ring, { width: 300, height: 300, borderRadius: 150, borderColor: r3, transform: [{ scale: pulse }] }]} />
      <Animated.View style={[rs.ring, { width: 210, height: 210, borderRadius: 105, borderColor: r2, transform: [{ scale: pulse }] }]} />
      <View style={[rs.ring, { width: 130, height: 130, borderRadius: 65, borderColor: r1 }]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold + '80', position: 'absolute' }} />
    </Animated.View>
  );
}
const rs = StyleSheet.create({ ring: { position: 'absolute', borderWidth: 1 } });

// ─── Feature card (used on slides 2 & 3) ─────────────────────────────────────
function FeatureCard({
  icon, color, bgColor, title, desc, anim, colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string; bgColor: string; title: string; desc: string;
  anim: Animated.Value; colors: any;
}) {
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) },
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      ],
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 10,
    }}>
      <View style={{
        width: 46, height: 46, borderRadius: 14,
        backgroundColor: bgColor,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: colors.textPrimary, marginBottom: 3 }}>
          {title}
        </Text>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>
          {desc}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Step dots ────────────────────────────────────────────────────────────────
function StepDots({ step, colors }: { step: number; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, justifyContent: 'center', marginBottom: 20, marginTop: 4 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
        <Animated.View
          key={s}
          style={{
            width: s === step ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: s === step ? colors.gold : colors.border,
          }}
        />
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const { colors, isDark } = useTheme();
  const { user, household, currency, profile, markOnboardingDone } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);

  // Step 4: income
  const [sourceName, setSourceName]     = useState('');
  const [sourceType, setSourceType]     = useState<IncomeType>('SALARY');
  const [sourceAmt,  setSourceAmt]      = useState('');
  const [sources, setSources]           = useState<Array<{ name: string; type: IncomeType; amount: number }>>([]);
  const [addingSource, setAddingSource] = useState(false);

  // Step 5: allocation
  const [allocAmounts, setAllocAmounts] = useState<number[]>(BUCKET_DEFAULTS.map(() => 0));
  const [savingAlloc, setSavingAlloc]   = useState(false);

  const firstName    = (profile?.name ?? 'friend').split(' ')[0];
  const totalIncome  = sources.reduce((s, r) => s + r.amount, 0);

  const CURRENCY_UNIT: Record<string, string> = { NGN: 'naira', USD: 'dollar', GBP: 'pound', EUR: 'euro' };
  const currencyUnit = CURRENCY_UNIT[currency] ?? 'money';

  useEffect(() => {
    if (totalIncome > 0) {
      setAllocAmounts(BUCKET_DEFAULTS.map((b) => Math.round((totalIncome * b.defaultPct) / 100)));
    }
  }, [totalIncome]);

  // ── Slide transition ────────────────────────────────────────────────────────
  const slideAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(1)).current;

  function goNext(next: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -SCREEN_W * 0.3, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(SCREEN_W * 0.3);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    });
  }

  // ── Welcome entrance animations ─────────────────────────────────────────────
  const wordmarkAnim = useRef(new Animated.Value(0)).current;
  const titleAnim    = useRef(new Animated.Value(0)).current;
  const propAnim     = useRef(new Animated.Value(0)).current;
  const ctaAnim      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(wordmarkAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(titleAnim,   { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(propAnim,    { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ctaAnim,     { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Feature slide animations (slide 2 & 3) ──────────────────────────────────
  const slide2Anims = useRef(SLIDE_2_FEATURES.map(() => new Animated.Value(0))).current;
  const slide3Anims = useRef(SLIDE_3_FEATURES.map(() => new Animated.Value(0))).current;
  const slideHeaderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 2) {
      slideHeaderAnim.setValue(0);
      slide2Anims.forEach(a => a.setValue(0));
      Animated.stagger(100, [
        Animated.timing(slideHeaderAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ...slide2Anims.map(a =>
          Animated.timing(a, { toValue: 1, duration: 480, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true })
        ),
      ]).start();
    }
    if (step === 3) {
      slideHeaderAnim.setValue(0);
      slide3Anims.forEach(a => a.setValue(0));
      Animated.stagger(100, [
        Animated.timing(slideHeaderAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ...slide3Anims.map(a =>
          Animated.timing(a, { toValue: 1, duration: 480, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true })
        ),
      ]).start();
    }
  }, [step]);

  // ── Step 4: Add income source ────────────────────────────────────────────────
  async function handleAddSource() {
    if (!sourceName.trim()) { Alert.alert('Name required', 'Enter a name for this income source.'); return; }
    const amt = parseInput(sourceAmt);
    if (!amt || amt <= 0) { Alert.alert('Amount required', 'Enter a valid amount.'); return; }
    if (!user) return;
    setAddingSource(true);
    const { error } = await (supabase as any).from('income_sources').insert({
      user_id: user.id,
      household_id: household?.id ?? null,
      name: sourceName.trim(),
      type: sourceType,
      amount: amt,
      subtitle: null,
    }).select().single();
    setAddingSource(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setSources((prev) => [...prev, { name: sourceName.trim(), type: sourceType, amount: amt }]);
    setSourceName('');
    setSourceAmt('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Step 5: Save allocation ──────────────────────────────────────────────────
  async function handleFinish() {
    if (!user) return;
    setSavingAlloc(true);
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    if (totalIncome > 0) {
      const rows = BUCKET_DEFAULTS.map((b, i) => ({
        user_id: user.id, household_id: household?.id ?? null,
        month, year, bucket_name: b.name, amount: allocAmounts[i],
        pct: totalIncome > 0 ? Number(((allocAmounts[i] / totalIncome) * 100).toFixed(2)) : 0,
      }));
      await (supabase as any).from('allocations').upsert(rows, { onConflict: 'user_id,month,year,bucket_name' });
    }

    await markOnboardingDone();
    setSavingAlloc(false);
    router.replace('/(tabs)');
  }

  async function handleSkip() {
    await markOnboardingDone();
    router.replace('/(tabs)');
  }

  // ── Styles ────────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    slide: { flex: 1 },

    // Welcome
    heroSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    wordmark: {
      fontFamily: FONTS.semibold, fontSize: 11, color: colors.gold,
      letterSpacing: 10, textTransform: 'uppercase', marginBottom: 20,
    },
    heroTitle: {
      fontFamily: FONTS.headingItalic, fontSize: 36, color: colors.textPrimary,
      textAlign: 'center', lineHeight: 46, marginTop: 24,
    },
    heroProp: {
      fontFamily: FONTS.regular, fontSize: 15, color: colors.textMuted,
      textAlign: 'center', lineHeight: 24, marginTop: 12,
    },

    // CTA
    ctaBtn:  { borderRadius: 18, overflow: 'hidden', marginTop: 32 },
    ctaInner: { height: 62, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
    ctaText: { fontFamily: FONTS.semibold, fontSize: 13, letterSpacing: 3, color: colors.gold },

    // Feature slides shared
    featureSection: { flex: 1, paddingHorizontal: 20 },
    featureHeader: { paddingTop: 8, paddingBottom: 20 },
    featureTitle: { fontFamily: FONTS.heading, fontSize: 28, color: colors.textPrimary, marginBottom: 6 },
    featureSub: { fontFamily: FONTS.regular, fontSize: 14, color: colors.textMuted, lineHeight: 21 },

    // Steps 4 & 5 shared
    stepContainer: { flex: 1 },
    stepHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
    stepTitle: { fontFamily: FONTS.heading, fontSize: 26, color: colors.textPrimary, marginBottom: 4 },
    stepSub: { fontFamily: FONTS.regular, fontSize: 14, color: colors.textMuted, lineHeight: 20 },

    // Income form
    formCard: {
      backgroundColor: colors.card, borderRadius: 20, margin: 20, marginTop: 12,
      padding: 20, borderWidth: isDark ? 1 : 0, borderColor: colors.border,
    },
    label: { fontFamily: FONTS.medium, fontSize: 10, color: colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
    input: {
      backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 13, fontFamily: FONTS.medium, fontSize: 15,
      color: colors.textPrimary, marginBottom: 16,
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    typeChipActive: { borderColor: colors.gold, backgroundColor: colors.goldBg },
    typeChipText: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textMuted },
    typeChipTextActive: { color: colors.gold },
    addBtn: {
      backgroundColor: colors.burgundy, borderRadius: 12, paddingVertical: 14,
      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    },
    addBtnText: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.gold },

    // Source list
    sourceItem: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
      borderRadius: 12, padding: 12, marginTop: 10, gap: 10,
    },
    sourceIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.goldBg, alignItems: 'center', justifyContent: 'center' },
    sourceName: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary },
    sourceTypeTxt: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },
    sourceAmt: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.gold, marginLeft: 'auto' as any },

    // Allocation
    allocBucket: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border,
      padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    allocIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    allocName: { fontFamily: FONTS.medium, fontSize: 14, color: colors.textPrimary, flex: 1 },
    allocInput: {
      backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
      paddingHorizontal: 10, paddingVertical: 8, fontFamily: FONTS.semibold, fontSize: 14,
      color: colors.textPrimary, textAlign: 'right', width: 100,
    },

    // Skip
    skipBtn: { alignItems: 'center', paddingVertical: 16 },
    skipText: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted },
  });

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <StepDots step={step} colors={colors} />

      <Animated.View style={[s.slide, { transform: [{ translateX: slideAnim }], opacity: fadeAnim }]}>

        {/* ══ STEP 1: Welcome ══════════════════════════════════════════════════ */}
        {step === 1 && (
          <View style={s.heroSection}>
            {/* Wordmark — sits above the rings, never overlapping */}
            <Animated.Text style={[s.wordmark, {
              opacity: wordmarkAnim,
              transform: [{ translateY: wordmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            }]}>
              Steward
            </Animated.Text>

            {/* Rings */}
            <Rings colors={colors} isDark={isDark} />

            {/* Hero text + CTA — pulled up slightly to sit close to rings */}
            <View style={{ alignItems: 'center', marginTop: -24, alignSelf: 'stretch', paddingHorizontal: 8 }}>
              <Animated.Text style={[s.heroTitle, {
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              }]}>
                Welcome, {firstName}.
              </Animated.Text>

              <Animated.Text style={[s.heroProp, {
                opacity: propAnim,
                transform: [{ translateY: propAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              }]}>
                Give every {currencyUnit} a purpose.{'\n'}Let's set up your finances in 2 minutes.
              </Animated.Text>

              <Animated.View style={[{ alignSelf: 'stretch' }, {
                opacity: ctaAnim,
                transform: [{ scale: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
              }]}>
                <TouchableOpacity style={[s.ctaBtn, { alignSelf: 'stretch' }]} onPress={() => goNext(2)} activeOpacity={0.9}>
                  <LinearGradient colors={['#4E0B0B', '#210909']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18 }}>
                    <View style={s.ctaInner}>
                      <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.gold} />
                      <Text style={s.ctaText}>GET STARTED</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
                  <Text style={s.skipText}>Skip setup · go straight in</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        )}

        {/* ══ STEP 2: Feature showcase — AI, Grades, Budgets ══════════════════ */}
        {step === 2 && (
          <View style={s.featureSection}>
            <Animated.View style={[s.featureHeader, {
              opacity: slideHeaderAnim,
              transform: [{ translateY: slideHeaderAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            }]}>
              <Text style={s.featureTitle}>Your finances,{'\n'}intelligently managed.</Text>
              <Text style={s.featureSub}>Here's what Steward brings to the table.</Text>
            </Animated.View>

            {SLIDE_2_FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} anim={slide2Anims[i]} colors={colors} />
            ))}

            {/* CTA */}
            <TouchableOpacity
              style={[s.ctaBtn, { marginTop: 16, alignSelf: 'stretch' }]}
              onPress={() => goNext(3)}
              activeOpacity={0.9}
            >
              <LinearGradient colors={['#4E0B0B', '#210909']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18 }}>
                <View style={s.ctaInner}>
                  <Text style={s.ctaText}>THERE'S MORE →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ STEP 3: Feature showcase — Debt, Security, Notifications ════════ */}
        {step === 3 && (
          <View style={s.featureSection}>
            <Animated.View style={[s.featureHeader, {
              opacity: slideHeaderAnim,
              transform: [{ translateY: slideHeaderAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            }]}>
              <Text style={s.featureTitle}>Built for the{'\n'}long game.</Text>
              <Text style={s.featureSub}>Tools that keep you disciplined and secure.</Text>
            </Animated.View>

            {SLIDE_3_FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} anim={slide3Anims[i]} colors={colors} />
            ))}

            <TouchableOpacity
              style={[s.ctaBtn, { marginTop: 16, alignSelf: 'stretch' }]}
              onPress={() => goNext(4)}
              activeOpacity={0.9}
            >
              <LinearGradient colors={['#4E0B0B', '#210909']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18 }}>
                <View style={s.ctaInner}>
                  <Ionicons name="wallet-outline" size={18} color={colors.gold} />
                  <Text style={s.ctaText}>SET UP MY FINANCES</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
              <Text style={s.skipText}>Skip setup · go straight in</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ STEP 4: Add Income ═══════════════════════════════════════════════ */}
        {step === 4 && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={s.stepHeader}>
                <Text style={s.stepTitle}>Add your income</Text>
                <Text style={s.stepSub}>Tell us where your money comes from each month.</Text>
              </View>

              <View style={s.formCard}>
                <Text style={s.label}>Source name</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Fidelity Salary"
                  placeholderTextColor={colors.textMuted}
                  value={sourceName}
                  onChangeText={setSourceName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  cursorColor={colors.gold}
                />

                <Text style={s.label}>Income type</Text>
                <View style={s.typeRow}>
                  {INCOME_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[s.typeChip, sourceType === t && s.typeChipActive]}
                      onPress={() => setSourceType(t)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.typeChipText, sourceType === t && s.typeChipTextActive]}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>Monthly amount ({CURRENCIES[currency].symbol})</Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={sourceAmt}
                  onChangeText={setSourceAmt}
                  keyboardType="numeric"
                  returnKeyType="done"
                  cursorColor={colors.gold}
                />

                <TouchableOpacity style={s.addBtn} onPress={handleAddSource} disabled={addingSource} activeOpacity={0.85}>
                  {addingSource
                    ? <ActivityIndicator size="small" color={colors.gold} />
                    : <>
                        <Ionicons name="add-circle-outline" size={18} color={colors.gold} />
                        <Text style={s.addBtnText}>{sources.length === 0 ? 'Add Source' : 'Add Another'}</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>

              {/* Added sources list */}
              {sources.length > 0 && (
                <View style={{ paddingHorizontal: 20 }}>
                  <Text style={[s.label, { marginBottom: 10 }]}>Added sources</Text>
                  {sources.map((src, i) => (
                    <View key={i} style={s.sourceItem}>
                      <View style={s.sourceIconWrap}>
                        <Ionicons name={TYPE_ICONS[src.type]} size={16} color={colors.gold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.sourceName}>{src.name}</Text>
                        <Text style={s.sourceTypeTxt}>{src.type}</Text>
                      </View>
                      <Text style={s.sourceAmt}>{fmt(src.amount, currency)}</Text>
                    </View>
                  ))}
                  <View style={{ backgroundColor: colors.goldBg, borderRadius: 12, padding: 14, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="wallet-outline" size={18} color={colors.gold} />
                    <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: colors.gold }}>
                      Total: {fmt(totalIncome, currency)}/mo
                    </Text>
                  </View>
                </View>
              )}

              <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                <TouchableOpacity style={[s.ctaBtn, { marginTop: 0 }]} onPress={() => goNext(5)} activeOpacity={0.9}>
                  <LinearGradient colors={['#4E0B0B', '#210909']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18 }}>
                    <View style={s.ctaInner}>
                      <Text style={s.ctaText}>{sources.length > 0 ? 'NEXT → ALLOCATE' : 'SKIP THIS STEP'}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ══ STEP 5: Allocate ═════════════════════════════════════════════════ */}
        {step === 5 && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={s.stepHeader}>
                <Text style={s.stepTitle}>Allocate your income</Text>
                <Text style={s.stepSub}>
                  {totalIncome > 0
                    ? `Distribute your ${fmt(totalIncome, currency)}/mo across buckets.`
                    : 'Set a suggested amount for each budget bucket.'}
                </Text>
              </View>

              {totalIncome > 0 && (
                <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.goldBg, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold }}>
                    Allocated: {fmt(allocAmounts.reduce((a, b) => a + b, 0), currency)}
                  </Text>
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.textMuted }}>
                    Remaining: {fmt(Math.max(0, totalIncome - allocAmounts.reduce((a, b) => a + b, 0)), currency)}
                  </Text>
                </View>
              )}

              <View style={{ paddingHorizontal: 20 }}>
                {BUCKET_DEFAULTS.map((bucket, i) => (
                  <View key={bucket.name} style={s.allocBucket}>
                    <View style={[s.allocIconWrap, { backgroundColor: bucket.color + '22' }]}>
                      <Ionicons name={bucket.icon as any} size={18} color={bucket.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.allocName}>{bucket.name}</Text>
                      {totalIncome > 0 && (
                        <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }}>
                          Suggested {bucket.defaultPct}% · {fmt(Math.round(totalIncome * bucket.defaultPct / 100), currency)}
                        </Text>
                      )}
                    </View>
                    <TextInput
                      style={s.allocInput}
                      value={allocAmounts[i] > 0 ? formatInput(allocAmounts[i].toString()) : ''}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      returnKeyType="done"
                      cursorColor={colors.gold}
                      onChangeText={(v) => {
                        const n = parseInput(v);
                        setAllocAmounts((prev) => prev.map((a, idx) => idx === i ? n : a));
                      }}
                      selectTextOnFocus
                    />
                  </View>
                ))}
              </View>

              <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
                <TouchableOpacity
                  style={[s.ctaBtn, { marginTop: 0 }]}
                  onPress={handleFinish}
                  disabled={savingAlloc}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={['#4E0B0B', '#210909']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18 }}>
                    <View style={s.ctaInner}>
                      {savingAlloc
                        ? <ActivityIndicator color={colors.gold} />
                        : <>
                            <Ionicons name="shield-checkmark-outline" size={18} color={colors.gold} />
                            <Text style={s.ctaText}>ENTER STEWARD</Text>
                          </>
                      }
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
                  <Text style={s.skipText}>Skip for now · I'll allocate later</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}
