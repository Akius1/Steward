import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ScrollView, Animated, Easing, Dimensions, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform,
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
import type { CurrencyCode } from '@/utils/currency';

const { width: SCREEN_W } = Dimensions.get('window');

const TOTAL_STEPS = 6;

const INCOME_TYPES: IncomeType[] = ['SALARY', 'FREELANCE', 'BUSINESS', 'GIFT', 'SIDE INCOME'];
const TYPE_ICONS: Record<IncomeType, React.ComponentProps<typeof Ionicons>['name']> = {
  SALARY:        'briefcase-outline',
  FREELANCE:     'laptop-outline',
  BUSINESS:      'business-outline',
  GIFT:          'gift-outline',
  'SIDE INCOME': 'flash-outline',
};

// Popular currencies shown first in step 2
const POPULAR_CURRENCIES: CurrencyCode[] = ['NGN', 'USD', 'GBP', 'EUR', 'KES', 'ZAR', 'CAD', 'GHS'];

// How-it-works steps (step 3)
const HOW_IT_WORKS = [
  {
    icon: 'wallet-outline'    as const,
    color: '#D4AF37',
    bg:    '#D4AF3722',
    title: 'Log your income',
    desc:  'Add every money source — salary, freelance, business. Steward tracks it all.',
  },
  {
    icon: 'pie-chart-outline' as const,
    color: '#60A5FA',
    bg:    '#60A5FA22',
    title: 'Allocate to buckets',
    desc:  'Decide exactly where each naira goes — rent, savings, food, wants and more.',
  },
  {
    icon: 'bar-chart-outline' as const,
    color: '#10B97A',
    bg:    '#10B97A22',
    title: 'Get your monthly grade',
    desc:  'Steward scores how well you stuck to your plan and coaches you to improve.',
  },
];

// Budget styles (step 5)
const BUDGET_STYLES = [
  {
    id:    '50-30-20'  as const,
    icon:  'aperture-outline'  as const,
    color: '#D4AF37',
    bg:    '#D4AF3720',
    title: '50 / 30 / 20',
    sub:   'The classic rule',
    desc:  '50% needs · 30% wants · 20% savings & investments',
  },
  {
    id:    'smart'     as const,
    icon:  'sparkles-outline'  as const,
    color: '#10B97A',
    bg:    '#10B97A20',
    title: 'Smart Defaults',
    sub:   'Recommended for you',
    desc:  'Steward suggests allocations based on proven budgeting guidelines.',
  },
  {
    id:    'custom'    as const,
    icon:  'construct-outline' as const,
    color: '#A78BFA',
    bg:    '#A78BFA20',
    title: 'Custom Buckets',
    sub:   'Full control',
    desc:  'You decide how every naira is split — total flexibility.',
  },
] as const;

type BudgetStyleId = typeof BUDGET_STYLES[number]['id'];

// ─── Animated progress bar ────────────────────────────────────────────────────
function ProgressBar({ step, colors }: { step: number; colors: any }) {
  const anim = useRef(new Animated.Value((step - 1) / (TOTAL_STEPS - 1))).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: (step - 1) / (TOTAL_STEPS - 1),
      duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [step]);
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 }}>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
        <Animated.View style={{
          height: 3, borderRadius: 2, backgroundColor: colors.gold,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }} />
      </View>
      <Text style={{
        fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted,
        textAlign: 'right', marginTop: 4, letterSpacing: 0.5,
      }}>
        {step} of {TOTAL_STEPS}
      </Text>
    </View>
  );
}

// ─── Gold CTA button ──────────────────────────────────────────────────────────
function CtaButton({ label, onPress, loading, icon, style }: {
  label: string; onPress: () => void; loading?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name']; style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ borderRadius: 18, overflow: 'hidden' }, style, { transform: [{ scale }] }]}>
      <LinearGradient colors={['#4E0B0B', '#210909']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18 }}>
        <TouchableOpacity
          style={{ height: 60, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}
          onPress={onPress}
          onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 220, friction: 10 }).start()}
          onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 10 }).start()}
          disabled={loading}
          activeOpacity={1}
        >
          {loading
            ? <ActivityIndicator color="#D4AF37" />
            : <>
                {icon && <Ionicons name={icon} size={17} color="#D4AF37" />}
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, letterSpacing: 3, color: '#D4AF37' }}>
                  {label}
                </Text>
              </>
          }
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Pulsing rings (welcome screen) ──────────────────────────────────────────
function Rings({ colors, isDark }: { colors: any; isDark: boolean }) {
  const pulse    = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const r1 = colors.gold + (isDark ? '2a' : '30');
  const r2 = colors.gold + (isDark ? '18' : '1e');
  const r3 = colors.gold + (isDark ? '0e' : '12');
  return (
    <Animated.View style={{ alignItems: 'center', justifyContent: 'center', opacity: entrance, transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }] }}>
      <Animated.View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 1, borderColor: r3, transform: [{ scale: pulse }] }} />
      <Animated.View style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95,  borderWidth: 1, borderColor: r2, transform: [{ scale: pulse }] }} />
      <View                style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55,  borderWidth: 1, borderColor: r1 }} />
      <View                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold + '80' }} />
    </Animated.View>
  );
}

// ─── Currency step (extracted to avoid ScrollView/Animated.View gesture conflict)
// Using FlatList outside the parent Animated.View gives buttery-smooth scroll
const OTHER_CURRENCIES = (Object.keys(CURRENCIES) as CurrencyCode[]).filter(
  c => !POPULAR_CURRENCIES.includes(c)
);
const ITEM_HEIGHT = 58; // fixed height for getItemLayout

function CurrencyStep({ selectedCurrency, onSelect, onContinue, colors, isDark, stepStyle }: {
  selectedCurrency: CurrencyCode;
  onSelect: (c: CurrencyCode) => void;
  onContinue: () => void;
  colors: any; isDark: boolean; stepStyle: any;
}) {
  const renderItem = useCallback(({ item: code }: { item: CurrencyCode }) => {
    const meta   = CURRENCIES[code];
    const active = selectedCurrency === code;
    return (
      <TouchableOpacity
        onPress={() => onSelect(code)}
        activeOpacity={0.75}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 14,
          paddingHorizontal: 20, height: ITEM_HEIGHT,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: active ? colors.goldBg : 'transparent',
        }}
      >
        <Text style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{meta.flag}</Text>
        <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: active ? colors.gold : colors.textPrimary, width: 44 }}>{code}</Text>
        <Text style={{ flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted }}>{meta.name}</Text>
        {active
          ? <Ionicons name="checkmark-circle" size={18} color={colors.gold} style={{ marginRight: 4 }} />
          : <View style={{ width: 18, marginRight: 4 }} />
        }
      </TouchableOpacity>
    );
  }, [selectedCurrency, colors]);

  const listHeader = (
    <View>
      {/* Step header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
        <Text style={stepStyle.stepTitle}>Your currency</Text>
        <Text style={stepStyle.stepSub}>Where do you earn? We'll format all amounts accordingly.</Text>
      </View>

      {/* Popular grid */}
      <Text style={{ fontFamily: FONTS.medium, fontSize: 10, color: colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 10 }}>
        Popular
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
        {POPULAR_CURRENCIES.map((code) => {
          const meta   = CURRENCIES[code];
          const active = selectedCurrency === code;
          return (
            <TouchableOpacity
              key={code}
              onPress={() => onSelect(code)}
              activeOpacity={0.75}
              style={{
                width: (SCREEN_W - 48 - 10) / 2,
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 14, paddingVertical: 12,
                borderRadius: 14, borderWidth: 1.5,
                borderColor: active ? colors.gold : colors.border,
                backgroundColor: active ? colors.goldBg : colors.card,
              }}
            >
              <Text style={{ fontSize: 22 }}>{meta.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: active ? colors.gold : colors.textPrimary }}>{code}</Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }} numberOfLines={1}>{meta.name}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={16} color={colors.gold} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Others label */}
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
        <Text style={{ fontFamily: FONTS.medium, fontSize: 10, color: colors.textMuted, letterSpacing: 2, textTransform: 'uppercase' }}>
          Other currencies
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={OTHER_CURRENCIES}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={<View style={{ height: 100 }} />}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
      />
      {/* Floating CTA pinned to bottom */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 24, paddingBottom: 16, paddingTop: 10,
        backgroundColor: colors.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
      }}>
        <CtaButton label="CONTINUE" icon="arrow-forward" onPress={onContinue} />
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const { colors, isDark } = useTheme();
  const { user, household, currency: authCurrency, profile, markOnboardingDone, setCurrency, refreshProfile } = useAuth();
  const router = useRouter();

  const [step, setStep]                   = useState(1);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(authCurrency);
  const [sourceName, setSourceName]       = useState('');
  const [sourceType, setSourceType]       = useState<IncomeType>('SALARY');
  const [sourceAmt, setSourceAmt]         = useState('');
  const [incomeAdded, setIncomeAdded]     = useState(false);
  const [addingIncome, setAddingIncome]   = useState(false);
  const [budgetStyle, setBudgetStyle]     = useState<BudgetStyleId | null>(null);
  const [saving, setSaving]               = useState(false);
  const [totalIncome, setTotalIncome]     = useState(0);

  const firstName = (profile?.name ?? 'friend').split(' ')[0];

  // ── Slide transition ──────────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  function goNext(next: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -SCREEN_W * 0.25, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(SCREEN_W * 0.25);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  }

  function goBack(prev: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_W * 0.25, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setStep(prev);
      slideAnim.setValue(-SCREEN_W * 0.25);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  }

  // ── Welcome entrance anims ────────────────────────────────────────────────────
  const w1 = useRef(new Animated.Value(0)).current;
  const w2 = useRef(new Animated.Value(0)).current;
  const w3 = useRef(new Animated.Value(0)).current;
  const w4 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.stagger(110, [w1, w2, w3, w4].map(a =>
      Animated.timing(a, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    )).start();
  }, []);

  // ── How it works card anims ───────────────────────────────────────────────────
  const howAnims = useRef(HOW_IT_WORKS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (step === 3) {
      howAnims.forEach(a => a.setValue(0));
      Animated.stagger(120, howAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true })
      )).start();
    }
  }, [step]);

  // ── Budget style card anims ───────────────────────────────────────────────────
  const styleAnims = useRef(BUDGET_STYLES.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (step === 5) {
      styleAnims.forEach(a => a.setValue(0));
      Animated.stagger(100, styleAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true })
      )).start();
    }
  }, [step]);

  // ── Done screen anim ──────────────────────────────────────────────────────────
  const doneAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (step === 6) {
      doneAnim.setValue(0);
      Animated.spring(doneAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
    }
  }, [step]);

  // ── Save currency and proceed ─────────────────────────────────────────────────
  async function handleCurrencyNext() {
    if (selectedCurrency !== authCurrency) {
      await setCurrency(selectedCurrency);
    }
    goNext(3);
  }

  // ── Save income source ────────────────────────────────────────────────────────
  async function handleAddIncome() {
    const amt = parseInput(sourceAmt);
    if (!sourceName.trim()) { Alert.alert('Name required', 'Give this income source a name.'); return; }
    if (!amt || amt <= 0)   { Alert.alert('Amount required', 'Enter a valid monthly amount.'); return; }
    if (!user) return;
    setAddingIncome(true);
    const { error } = await (supabase as any).from('income_sources').insert({
      user_id: user.id,
      household_id: household?.id ?? null,
      name: sourceName.trim(),
      type: sourceType,
      amount: amt,
      subtitle: null,
    });
    setAddingIncome(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setTotalIncome(amt);
    setIncomeAdded(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // ── Save allocations based on style then finish ───────────────────────────────
  async function handleFinish() {
    if (!user) return;
    setSaving(true);

    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    let pcts: number[] = BUCKET_DEFAULTS.map(b => b.defaultPct);

    if (budgetStyle === '50-30-20') {
      // Needs (50%): Rent, Food, Utilities | Wants (30%): Entertainment, Giving, Covenant | Savings (20%): Savings, Investments, Emergency
      pcts = [28, 12, 10, 10, 8, 7, 8, 9, 8]; // mapped to BUCKET_DEFAULTS order
    } else if (budgetStyle === 'custom') {
      pcts = BUCKET_DEFAULTS.map(() => 0);
    }
    // 'smart' uses BUCKET_DEFAULTS defaultPct (already set)

    if (totalIncome > 0) {
      const rows = BUCKET_DEFAULTS.map((b, i) => ({
        user_id: user.id, household_id: household?.id ?? null,
        month, year, bucket_name: b.name,
        amount: Math.round((totalIncome * pcts[i]) / 100),
        pct: pcts[i],
      }));
      await (supabase as any).from('allocations').upsert(rows, { onConflict: 'user_id,month,year,bucket_name' });
    }

    await markOnboardingDone();
    setSaving(false);
    router.replace('/(tabs)');
  }

  async function handleSkip() {
    await markOnboardingDone();
    router.replace('/(tabs)');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: colors.bg },
    slide:   { flex: 1 },
    padH:    { paddingHorizontal: 24 },

    // Step header
    stepTitle: { fontFamily: FONTS.heading, fontSize: 28, color: colors.textPrimary, marginBottom: 6 },
    stepSub:   { fontFamily: FONTS.regular, fontSize: 14, color: colors.textMuted, lineHeight: 21 },

    // Input
    label: { fontFamily: FONTS.medium, fontSize: 10, color: colors.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
    input: {
      backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 13, fontFamily: FONTS.medium, fontSize: 15,
      color: colors.textPrimary,
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
    typeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    typeChipActive: { borderColor: colors.gold, backgroundColor: colors.goldBg },
    typeChipText: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textMuted },
    typeChipTextActive: { color: colors.gold },

    // Skip
    skipBtn: { alignItems: 'center', paddingVertical: 16 },
    skipText: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted },
  });

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ProgressBar step={step} colors={colors} />

      {/* Back button — visible on steps 2–6 */}
      {step > 1 && (
        <TouchableOpacity
          onPress={() => goBack(step - 1)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
          <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: colors.textMuted }}>Back</Text>
        </TouchableOpacity>
      )}

      <Animated.View style={[s.slide, { transform: [{ translateX: slideAnim }], opacity: fadeAnim }]}>

        {/* ══ STEP 1: Welcome ══════════════════════════════════════════════════ */}
        {step === 1 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            {/* Rings */}
            <Rings colors={colors} isDark={isDark} />

            <View style={{ alignItems: 'center', marginTop: -20, alignSelf: 'stretch' }}>
              {/* Wordmark */}
              <Animated.Text style={{
                fontFamily: FONTS.semibold, fontSize: 10, color: colors.gold,
                letterSpacing: 10, textTransform: 'uppercase', marginBottom: 20,
                opacity: w1, transform: [{ translateY: w1.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
              }}>
                Steward
              </Animated.Text>

              {/* Greeting */}
              <Animated.Text style={{
                fontFamily: FONTS.headingItalic, fontSize: 34, color: colors.textPrimary,
                textAlign: 'center', lineHeight: 44, marginBottom: 12,
                opacity: w2, transform: [{ translateY: w2.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              }}>
                {`Welcome,\n${firstName}.`}
              </Animated.Text>

              {/* Tagline */}
              <Animated.Text style={{
                fontFamily: FONTS.regular, fontSize: 15, color: colors.textMuted,
                textAlign: 'center', lineHeight: 24, marginBottom: 32,
                opacity: w3, transform: [{ translateY: w3.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              }}>
                {'Your personal money steward is ready.\nLet\'s get you set up in under 2 minutes.'}
              </Animated.Text>

              {/* CTA */}
              <Animated.View style={{ alignSelf: 'stretch', opacity: w4, transform: [{ scale: w4.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }}>
                <CtaButton label="LET'S BEGIN" icon="arrow-forward-circle-outline" onPress={() => goNext(2)} style={{ marginBottom: 0 }} />
                <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
                  <Text style={s.skipText}>Skip setup · go straight in</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        )}

        {/* ══ STEP 2: Currency ═════════════════════════════════════════════════ */}
        {step === 2 && (
          <CurrencyStep
            selectedCurrency={selectedCurrency}
            onSelect={(code) => { setSelectedCurrency(code); Haptics.selectionAsync(); }}
            onContinue={handleCurrencyNext}
            colors={colors}
            isDark={isDark}
            stepStyle={s}
          />
        )}

        {/* ══ STEP 3: How It Works ═════════════════════════════════════════════ */}
        {step === 3 && (
          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            <View style={{ paddingTop: 20, paddingBottom: 24 }}>
              <Text style={s.stepTitle}>Here's how{'\n'}Steward works.</Text>
              <Text style={s.stepSub}>Three simple steps. That's all it takes.</Text>
            </View>

            {HOW_IT_WORKS.map((item, i) => (
              <Animated.View
                key={item.title}
                style={{
                  opacity: howAnims[i],
                  transform: [
                    { translateY: howAnims[i].interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
                    { scale: howAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                  ],
                  flexDirection: 'row', alignItems: 'flex-start', gap: 16,
                  backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 12,
                  borderWidth: isDark ? 1 : 0, borderColor: colors.border,
                }}
              >
                {/* Step number + icon */}
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 14,
                    backgroundColor: item.bg,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <View style={{ width: 1.5, height: 16, backgroundColor: colors.border }} />
                  )}
                </View>
                <View style={{ flex: 1, paddingTop: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <View style={{
                      width: 20, height: 20, borderRadius: 10,
                      backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: item.color }}>{i + 1}</Text>
                    </View>
                    <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: colors.textPrimary }}>{item.title}</Text>
                  </View>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>{item.desc}</Text>
                </View>
              </Animated.View>
            ))}

            <View style={{ flex: 1 }} />
            <CtaButton label="GOT IT  →" onPress={() => goNext(4)} style={{ marginBottom: 16 }} />
          </View>
        )}

        {/* ══ STEP 4: Income ═══════════════════════════════════════════════════ */}
        {step === 4 && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={[s.padH, { paddingTop: 20, paddingBottom: 8 }]}>
                <Text style={s.stepTitle}>Your income</Text>
                <Text style={s.stepSub}>Tell us where your money comes from each month. You can add more later.</Text>
              </View>

              {incomeAdded ? (
                /* ── Added successfully ── */
                <View style={{ marginHorizontal: 24, marginTop: 16 }}>
                  <View style={{
                    backgroundColor: colors.card, borderRadius: 18, padding: 20,
                    borderWidth: 1, borderColor: colors.gold + '40',
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                  }}>
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.goldBg, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={TYPE_ICONS[sourceType]} size={22} color={colors.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary }}>{sourceName}</Text>
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' }}>
                        {sourceType.toLowerCase()} · {fmt(totalIncome, selectedCurrency)}/mo
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={24} color={colors.gold} />
                  </View>

                  <View style={{ backgroundColor: colors.goldBg, borderRadius: 14, padding: 14, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="wallet-outline" size={18} color={colors.gold} />
                    <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.gold }}>
                      Monthly income: {fmt(totalIncome, selectedCurrency)}
                    </Text>
                  </View>

                  <View style={{ marginTop: 28 }}>
                    <CtaButton label="NEXT →" onPress={() => goNext(5)} />
                  </View>
                </View>
              ) : (
                /* ── Income form ── */
                <View style={{ marginHorizontal: 24, marginTop: 12, backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: isDark ? 1 : 0, borderColor: colors.border }}>
                  <Text style={s.label}>Source name</Text>
                  <TextInput
                    style={[s.input, { marginTop: 4 }]}
                    placeholder="e.g. Monthly Salary"
                    placeholderTextColor={colors.textMuted}
                    value={sourceName}
                    onChangeText={setSourceName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    cursorColor={colors.gold}
                  />

                  <Text style={s.label}>Type</Text>
                  <View style={s.typeRow}>
                    {INCOME_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[s.typeChip, sourceType === t && s.typeChipActive]}
                        onPress={() => setSourceType(t)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={TYPE_ICONS[t]} size={12} color={sourceType === t ? colors.gold : colors.textMuted} />
                        <Text style={[s.typeChipText, sourceType === t && s.typeChipTextActive]}>
                          {t.charAt(0) + t.slice(1).toLowerCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>Monthly amount ({CURRENCIES[selectedCurrency].symbol})</Text>
                  <TextInput
                    style={[s.input, { marginTop: 4 }]}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={sourceAmt}
                    onChangeText={setSourceAmt}
                    keyboardType="numeric"
                    returnKeyType="done"
                    cursorColor={colors.gold}
                  />

                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.burgundy, borderRadius: 12, paddingVertical: 14,
                      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                      marginTop: 20, opacity: addingIncome ? 0.7 : 1,
                    }}
                    onPress={handleAddIncome}
                    disabled={addingIncome}
                    activeOpacity={0.85}
                  >
                    {addingIncome
                      ? <ActivityIndicator size="small" color={colors.gold} />
                      : <>
                          <Ionicons name="add-circle-outline" size={18} color={colors.gold} />
                          <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.gold }}>Add Income Source</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {!incomeAdded && (
                <TouchableOpacity style={[s.skipBtn, { marginTop: 8 }]} onPress={() => goNext(5)}>
                  <Text style={s.skipText}>Skip · I'll add income later</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ══ STEP 5: Budget Style ══════════════════════════════════════════════ */}
        {step === 5 && (
          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            <View style={{ paddingTop: 20, paddingBottom: 20 }}>
              <Text style={s.stepTitle}>Pick your{'\n'}budget style.</Text>
              <Text style={s.stepSub}>This sets how your income is split across buckets. You can change it anytime.</Text>
            </View>

            {BUDGET_STYLES.map((style, i) => {
              const active = budgetStyle === style.id;
              return (
                <Animated.View
                  key={style.id}
                  style={{
                    opacity: styleAnims[i],
                    transform: [
                      { translateY: styleAnims[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                      { scale: styleAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                    ],
                    marginBottom: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => { setBudgetStyle(style.id); Haptics.selectionAsync(); }}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: active ? colors.card : colors.surface,
                      borderRadius: 18, padding: 18,
                      borderWidth: 2,
                      borderColor: active ? colors.gold : colors.border,
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                    }}
                  >
                    <View style={{
                      width: 52, height: 52, borderRadius: 14,
                      backgroundColor: active ? style.bg : colors.border + '40',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Ionicons name={style.icon} size={24} color={active ? style.color : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: FONTS.semibold, fontSize: 16, color: active ? colors.textPrimary : colors.textSecondary, marginBottom: 4 }}>
                        {style.title}
                      </Text>
                      <View style={{
                        alignSelf: 'flex-start',
                        backgroundColor: active ? style.bg : colors.border + '60',
                        borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
                        marginBottom: 5,
                      }}>
                        <Text style={{ fontFamily: FONTS.semibold, fontSize: 9, color: active ? style.color : colors.textMuted, letterSpacing: 0.8 }}>
                          {style.sub.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, lineHeight: 17 }}>{style.desc}</Text>
                    </View>
                    {active
                      ? <Ionicons name="checkmark-circle" size={22} color={colors.gold} />
                      : <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border }} />
                    }
                  </TouchableOpacity>
                </Animated.View>
              );
            })}

            <View style={{ flex: 1 }} />

            {budgetStyle ? (
              <CtaButton
                label="ALMOST THERE →"
                icon="shield-checkmark-outline"
                onPress={() => goNext(6)}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <TouchableOpacity style={[s.skipBtn, { marginBottom: 8 }]} onPress={() => goNext(6)}>
                <Text style={s.skipText}>Skip · use default allocations</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ══ STEP 6: All Set ═══════════════════════════════════════════════════ */}
        {step === 6 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
            {/* Badge */}
            <Animated.View style={{
              opacity: doneAnim,
              transform: [{ scale: doneAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              alignItems: 'center', marginBottom: 32,
            }}>
              <View style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: colors.goldBg,
                borderWidth: 2, borderColor: colors.gold + '50',
                alignItems: 'center', justifyContent: 'center', marginBottom: 0,
              }}>
                <Ionicons name="shield-checkmark" size={44} color={colors.gold} />
              </View>
            </Animated.View>

            <Animated.View style={{
              alignItems: 'center', alignSelf: 'stretch',
              opacity: doneAnim,
              transform: [{ translateY: doneAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }}>
              <Text style={{ fontFamily: FONTS.headingItalic, fontSize: 34, color: colors.textPrimary, textAlign: 'center', marginBottom: 10, lineHeight: 42 }}>
                {`You're all set,\n${firstName}.`}
              </Text>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: 32 }}>
                Steward is ready to help you make the most of every coin.
              </Text>

              {/* Summary pills */}
              <View style={{ alignSelf: 'stretch', gap: 10, marginBottom: 36 }}>
                {totalIncome > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: isDark ? 1 : 0, borderColor: colors.border }}>
                    <Ionicons name="wallet-outline" size={18} color={colors.gold} />
                    <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textPrimary }}>
                      Income: <Text style={{ color: colors.gold, fontFamily: FONTS.semibold }}>{fmt(totalIncome, selectedCurrency)}/mo</Text>
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: isDark ? 1 : 0, borderColor: colors.border }}>
                  <Ionicons name="flag-outline" size={18} color={colors.gold} />
                  <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textPrimary }}>
                    Budget style:{' '}
                    <Text style={{ color: colors.gold, fontFamily: FONTS.semibold }}>
                      {budgetStyle === '50-30-20' ? '50/30/20 Rule'
                        : budgetStyle === 'smart' ? 'Smart Defaults'
                        : budgetStyle === 'custom' ? 'Custom Buckets'
                        : 'Default'}
                    </Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: isDark ? 1 : 0, borderColor: colors.border }}>
                  <Text style={{ fontSize: 16 }}>{CURRENCIES[selectedCurrency].flag}</Text>
                  <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textPrimary }}>
                    Currency: <Text style={{ color: colors.gold, fontFamily: FONTS.semibold }}>{selectedCurrency}</Text>
                  </Text>
                </View>
              </View>

              <CtaButton
                label="ENTER STEWARD"
                icon="arrow-forward-circle-outline"
                onPress={handleFinish}
                loading={saving}
                style={{ alignSelf: 'stretch' }}
              />
            </Animated.View>
          </View>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}
