import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import DonutChart from '@/src/components/DonutChart';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { BottomSheetInput } from '@/utils/BottomSheetInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BUCKET_DEFAULTS, CUSTOM_BUCKET_COLORS, FONTS } from '@/constants/theme';
import { fmt, formatInput, parseInput, CURRENCIES } from '@/utils/currency';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BucketState {
  name: string;
  icon: string;
  color: string;
  amount: number;
  isCustom?: boolean;
}

// ─── Threshold logic ──────────────────────────────────────────────────────────
type ThresholdStatus = 'success' | 'warning' | 'danger' | null;

function getThreshold(bucketName: string, pct: number): { status: ThresholdStatus; message: string } | null {
  switch (bucketName) {
    case 'Rent & Housing':
      if (pct > 30) return { status: 'danger',  message: `Exceeds 30% ceiling · reduce by ${Math.round(pct - 30)}%` };
      if (pct > 28) return { status: 'warning', message: 'Near 28–30% threshold' };
      return { status: 'success', message: 'Within safe housing range' };
    case 'Food & Groceries':
      if (pct > 10) return { status: 'warning', message: 'Above 10% food guideline' };
      return { status: 'success', message: 'Within 8–10% food range' };
    case 'Savings':
      if (pct < 20) return { status: 'danger',  message: `Below 20% target · add ${Math.round(20 - pct)}%` };
      return { status: 'success', message: `${pct}% · above 20% minimum ✓` };
    case 'Emergency Fund':
      if (pct < 10) return { status: 'warning', message: 'Target: 10–15% to build 3-month cover' };
      return { status: 'success', message: 'Building emergency fund ✓' };
    case 'Covenant Practice':
      return { status: 'success', message: 'Honouring your covenant commitment ✓' };
    default:
      return null;
  }
}

const DEFAULT_NAMES = new Set(BUCKET_DEFAULTS.map((b) => b.name));

// Maps allocation bucket names → transaction categories that count against them
const BUCKET_CATEGORY_MAP: Record<string, string[]> = {
  'Rent & Housing':    ['Housing'],
  'Food & Groceries':  ['Food'],
  'Savings':           ['Savings'],
  'Investments':       ['Investment'],
  'Entertainment':     ['Entertainment'],
  'Emergency Fund':    [],
  'Giving':            [],
  'Covenant Practice': [],
  'Utilities':         ['Utilities'],
};

// ─── Add Bucket Modal ─────────────────────────────────────────────────────────
function AddBucketModal({
  visible, onClose, onAdd, totalIncome, existingNames, colors, isDark,
}: {
  visible: boolean; onClose: () => void;
  onAdd: (name: string, pct: number) => void;
  totalIncome: number; existingNames: Set<string>;
  colors: any; isDark: boolean;
}) {
  const [name, setName] = useState('');
  const [pct, setPct] = useState('');
  const sheetRef = useRef<BottomSheetModal>(null);
  const pctRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name required', 'Enter a name for your bucket.'); return; }
    if (existingNames.has(trimmed)) { Alert.alert('Duplicate', 'A bucket with that name already exists.'); return; }
    const p = parseFloat(pct.replace(',', '.'));
    if (isNaN(p) || p <= 0 || p > 100) { Alert.alert('Invalid %', 'Enter a percentage between 1 and 100.'); return; }
    onAdd(trimmed, p);
    setName('');
    setPct('');
    onClose();
  }

  const amount = totalIncome > 0 && !isNaN(parseFloat(pct)) ? Math.round(totalIncome * parseFloat(pct) / 100) : 0;

  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: colors.textPrimary,
    includeFontPadding: false,
  };

  const labelStyle = {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
    marginTop: 12,
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableDynamicSizing={true}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      backgroundStyle={{ backgroundColor: colors.card, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 4, marginTop: 8 }}>
          Add Custom Bucket
        </Text>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 20, lineHeight: 20 }}>
          Create a personalised spending or saving category.
        </Text>

        <Text style={labelStyle}>BUCKET NAME</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="e.g. Car Maintenance"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={40}
          returnKeyType="next"
          onSubmitEditing={() => pctRef.current?.focus()}
          blurOnSubmit={false}
        />

        <Text style={labelStyle}>PERCENTAGE OF INCOME (%)</Text>
        <BottomSheetInput
          ref={pctRef}
          style={inputStyle}
          placeholder="e.g. 5"
          placeholderTextColor={colors.textMuted}
          value={pct}
          onChangeText={setPct}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />

        {amount > 0 && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: colors.goldBg, borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 8, marginTop: 10,
          }}>
            <Ionicons name="calculator-outline" size={14} color={colors.gold} />
            <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: colors.gold }}>
              That's {fmt(amount, 'NGN')} of your income
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={{ backgroundColor: colors.gold, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 }}
          onPress={handleAdd}
          activeOpacity={0.85}
        >
          <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: isDark ? colors.bg : '#FFF' }}>Add Bucket</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 14 }} onPress={onClose}>
          <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AllocationScreen() {
  const { colors, isDark } = useTheme();
  const { user, household, currency } = useAuth();

  const [totalIncome, setTotalIncome] = useState(0);
  const [buckets, setBuckets] = useState<BucketState[]>(
    BUCKET_DEFAULTS.map((b) => ({ name: b.name, icon: b.icon, color: b.color, amount: 0 }))
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [focusedBucket, setFocusedBucket] = useState<string | null>(null);
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // ── Budget vs Actual ──────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'plan' | 'actual'>('plan');
  const [actualSpends, setActualSpends] = useState<Record<string, number>>({});
  const [actualLoading, setActualLoading] = useState(false);
  const [actualLoaded, setActualLoaded] = useState(false);

  // ── Monthly Reset ─────────────────────────────────────────────────────────
  const resetSheetRef = useRef<BottomSheetModal>(null);
  const [lastMonthRows, setLastMonthRows] = useState<any[]>([]);

  const scrollRef = useRef<ScrollView>(null);
  // Store each bucket card's Y offset so we can scroll to it when focused
  const cardOffsets = useRef<Record<string, number>>({});

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setFocusedBucket(null);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthLabel = now.toLocaleString('en-NG', { month: 'long', year: 'numeric' });

  const totalAllocated = useMemo(
    () => buckets.reduce((s, b) => s + b.amount, 0),
    [buckets]
  );
  const remaining = totalIncome - totalAllocated;
  const allocPct = totalIncome > 0 ? Math.round((totalAllocated / totalIncome) * 100) : 0;
  const isBalanced = Math.abs(remaining) < 10;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let incomeQuery = (supabase as any).from('income_sources').select('amount');
    incomeQuery = household
      ? incomeQuery.eq('household_id', household.id)
      : incomeQuery.eq('user_id', user.id).is('household_id', null);
    const { data: sources } = await incomeQuery;
    const income = ((sources ?? []) as Array<{ amount: number }>).reduce((s, r) => s + r.amount, 0);
    setTotalIncome(income);

    let allocQuery = (supabase as any).from('allocations').select('*').eq('month', month).eq('year', year);
    allocQuery = household
      ? allocQuery.eq('household_id', household.id)
      : allocQuery.eq('user_id', user.id).is('household_id', null);
    const { data: existing } = await allocQuery;

    if (existing && existing.length > 0) {
      const defaultBuckets = BUCKET_DEFAULTS.map((b) => {
        const found = (existing as Array<any>).find((e) => e.bucket_name === b.name);
        return { name: b.name, icon: b.icon, color: b.color, amount: found ? found.amount : 0, isCustom: false };
      });
      const customBuckets = (existing as Array<any>)
        .filter((e) => !DEFAULT_NAMES.has(e.bucket_name))
        .map((e, i) => ({
          name: e.bucket_name, icon: 'wallet-outline',
          color: CUSTOM_BUCKET_COLORS[i % CUSTOM_BUCKET_COLORS.length],
          amount: e.amount, isCustom: true,
        }));
      setBuckets([...defaultBuckets, ...customBuckets]);
    } else if (income > 0) {
      // No current-month plan — check if last month had one
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      let prevQ = (supabase as any).from('allocations').select('*').eq('month', prevM).eq('year', prevY);
      prevQ = household
        ? prevQ.eq('household_id', household.id)
        : prevQ.eq('user_id', user.id).is('household_id', null);
      const { data: prevRows } = await prevQ;

      if (prevRows && prevRows.length > 0) {
        setLastMonthRows(prevRows);
        // Show suggested default for now; reset sheet will let user choose
        setBuckets(
          BUCKET_DEFAULTS.map((b) => ({
            name: b.name, icon: b.icon, color: b.color,
            amount: Math.round((income * b.defaultPct) / 100),
            isCustom: false,
          }))
        );
        // Defer sheet presentation until after render
        setTimeout(() => resetSheetRef.current?.present(), 600);
      } else {
        setBuckets(
          BUCKET_DEFAULTS.map((b) => ({
            name: b.name, icon: b.icon, color: b.color,
            amount: Math.round((income * b.defaultPct) / 100),
            isCustom: false,
          }))
        );
      }
    }
    setLoading(false);
  }, [user, household, month, year]);

  useEffect(() => { load(); }, [load]);

  const loadActual = useCallback(async () => {
    if (!user || actualLoaded) return;
    setActualLoading(true);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

    let q = (supabase as any)
      .from('transactions')
      .select('category, amount')
      .eq('type', 'expense')
      .gte('date', start)
      .lt('date', end);
    q = household ? q.eq('household_id', household.id) : q.eq('user_id', user.id).is('household_id', null);

    const { data } = await q;
    const sums: Record<string, number> = {};
    for (const row of (data ?? []) as Array<{ category: string; amount: number }>) {
      sums[row.category] = (sums[row.category] ?? 0) + row.amount;
    }
    setActualSpends(sums);
    setActualLoaded(true);
    setActualLoading(false);
  }, [user, household, month, year, actualLoaded]);

  function handleToggleMode(mode: 'plan' | 'actual') {
    setViewMode(mode);
    if (mode === 'actual') loadActual();
  }

  function applyResetOption(option: 'copy' | 'fresh' | 'suggested') {
    resetSheetRef.current?.dismiss();
    if (option === 'copy') {
      const defaultBuckets = BUCKET_DEFAULTS.map((b) => {
        const found = lastMonthRows.find((r: any) => r.bucket_name === b.name);
        return { name: b.name, icon: b.icon, color: b.color, amount: found ? found.amount : 0, isCustom: false };
      });
      const customBuckets = lastMonthRows
        .filter((r: any) => !DEFAULT_NAMES.has(r.bucket_name))
        .map((r: any, i: number) => ({
          name: r.bucket_name, icon: 'wallet-outline',
          color: CUSTOM_BUCKET_COLORS[i % CUSTOM_BUCKET_COLORS.length],
          amount: r.amount, isCustom: true,
        }));
      setBuckets([...defaultBuckets, ...customBuckets]);
    } else if (option === 'fresh') {
      setBuckets(BUCKET_DEFAULTS.map((b) => ({ name: b.name, icon: b.icon, color: b.color, amount: 0, isCustom: false })));
    } else {
      setBuckets(
        BUCKET_DEFAULTS.map((b) => ({
          name: b.name, icon: b.icon, color: b.color,
          amount: Math.round((totalIncome * b.defaultPct) / 100),
          isCustom: false,
        }))
      );
    }
  }

  function updateAmount(bucketName: string, raw: string) {
    const n = parseInput(raw);
    setBuckets((prev) => prev.map((b) => (b.name === bucketName ? { ...b, amount: n } : b)));
  }

  function handleFocus(bucketName: string) {
    setFocusedBucket(bucketName);
    // Delay to let the keyboard appear, then scroll card into view
    setTimeout(() => {
      const y = cardOffsets.current[bucketName];
      if (y !== undefined && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 120), animated: true });
      }
    }, 150);
  }

  function addCustomBucket(name: string, pct: number) {
    const amount = totalIncome > 0 ? Math.round((totalIncome * pct) / 100) : 0;
    const colorIndex = buckets.filter((b) => b.isCustom).length;
    setBuckets((prev) => [
      ...prev,
      { name, icon: 'wallet-outline', color: CUSTOM_BUCKET_COLORS[colorIndex % CUSTOM_BUCKET_COLORS.length], amount, isCustom: true },
    ]);
  }

  function removeCustomBucket(name: string) {
    Alert.alert('Remove bucket', `Remove "${name}" from your allocation?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setBuckets((prev) => prev.filter((b) => b.name !== name)) },
    ]);
  }

  async function handleSave() {
    if (keyboardVisible) { Keyboard.dismiss(); return; }
    if (!user) return;
    if (totalIncome === 0) {
      Alert.alert('No income', 'Add at least one income source on the Income tab first.');
      return;
    }
    if (!isBalanced) {
      Alert.alert(
        'Allocation incomplete',
        remaining > 0
          ? `You still have ${fmt(remaining, currency)} unallocated. Steward requires 100% allocation.`
          : `You've over-allocated by ${fmt(Math.abs(remaining), currency)}. Reduce a bucket to fix this.`
      );
      return;
    }
    setSaving(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { setSaving(false); Alert.alert('Session expired', 'Please sign in again.'); return; }
    const rows = buckets.map((b) => ({
      user_id: currentUser.id, household_id: household?.id ?? null,
      month, year, bucket_name: b.name, amount: b.amount,
      pct: totalIncome > 0 ? Number(((b.amount / totalIncome) * 100).toFixed(2)) : 0,
    }));
    const { error } = await (supabase as any).from('allocations').upsert(rows, { onConflict: 'user_id,month,year,bucket_name' });
    setSaving(false);
    if (error) Alert.alert('Save failed', error.message);
    else Alert.alert('Saved ✓', 'Your allocation for ' + monthLabel + ' has been saved.');
  }

  function autoBalance() {
    if (totalIncome === 0 || remaining === 0) return;
    setBuckets((prev) => {
      const copy = [...prev];
      const savingsIdx = copy.findIndex((b) => b.name === 'Savings');
      const target = savingsIdx >= 0 ? savingsIdx : 0;
      copy[target] = { ...copy[target], amount: Math.max(0, copy[target].amount + remaining) };
      return copy;
    });
  }

  const existingNames = useMemo(() => new Set(buckets.map((b) => b.name)), [buckets]);
  const s = makeStyles(colors, isDark);

  if (loading) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (totalIncome === 0) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Allocation</Text>
            <Text style={s.headerSub}>{monthLabel}</Text>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="pie-chart-outline" size={56} color={colors.textMuted} />
          <Text style={{ fontFamily: FONTS.heading, fontSize: 20, color: colors.textPrimary, marginTop: 16, marginBottom: 8, textAlign: 'center' }}>
            No income sources found
          </Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
            Add your income sources on the Income tab first, then come back to allocate.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Fixed Header ─────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Allocation</Text>
          <Text style={s.headerSub}>{monthLabel}</Text>
        </View>
        {viewMode === 'plan' && (
          <TouchableOpacity
            style={[s.saveBtn, keyboardVisible ? s.saveBtnDone : (!isBalanced || saving) ? s.saveBtnDisabled : null]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} size="small" />
              : <Text style={s.saveBtnText}>{keyboardVisible ? 'Done ✓' : 'Save'}</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* ── Plan / Actual toggle ─────────────────────────── */}
      <View style={s.modeToggle}>
        {(['plan', 'actual'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[s.modeBtn, viewMode === m && s.modeBtnActive]}
            onPress={() => handleToggleMode(m)}
            activeOpacity={0.8}
          >
            <Text style={[s.modeBtnText, viewMode === m && s.modeBtnTextActive]}>
              {m === 'plan' ? 'Budget' : 'Actual'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Actual view ──────────────────────────────────── */}
      {viewMode === 'actual' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          {actualLoading ? (
            <ActivityIndicator color={colors.gold} size="large" style={{ marginTop: 60 }} />
          ) : (
            <View style={s.section}>
              {/* Actual summary bar */}
              <View style={[s.summaryCard, { marginHorizontal: 0, marginBottom: 16 }]}>
                <Text style={s.summaryLabel}>TOTAL BUDGETED</Text>
                <Text style={s.summaryTotal}>{fmt(totalAllocated, currency)}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <View>
                    <Text style={{ fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>SPENT</Text>
                    <Text style={{ fontFamily: FONTS.semibold, fontSize: 18, color: colors.danger }}>
                      {fmt(Object.values(actualSpends).reduce((a, b) => a + b, 0), currency)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>REMAINING</Text>
                    <Text style={{ fontFamily: FONTS.semibold, fontSize: 18, color: colors.success }}>
                      {fmt(Math.max(0, totalAllocated - Object.values(actualSpends).reduce((a, b) => a + b, 0)), currency)}
                    </Text>
                  </View>
                </View>
              </View>

              {buckets.map((bucket, i) => {
                const cats = BUCKET_CATEGORY_MAP[bucket.name] ?? [];
                const spent = cats.reduce((sum, cat) => sum + (actualSpends[cat] ?? 0), 0);
                const budgeted = bucket.amount;
                const ratio = budgeted > 0 ? spent / budgeted : 0;
                const overBudget = ratio >= 1;
                const nearLimit = ratio >= 0.75 && !overBudget;
                const barColor = overBudget ? colors.danger : nearLimit ? colors.warning : colors.success;
                const remaining = budgeted - spent;

                return (
                  <View key={bucket.name} style={[s.bucketCard, i > 0 && s.mt10]}>
                    <View style={s.bucketTop}>
                      <View style={[s.bucketIconWrap, { backgroundColor: bucket.color + '22', borderColor: bucket.color + '44' }]}>
                        <Ionicons name={bucket.icon as any} size={20} color={bucket.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.bucketName}>{bucket.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
                          <View>
                            <Text style={{ fontFamily: FONTS.medium, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Budget</Text>
                            <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary }}>{fmt(budgeted, currency)}</Text>
                          </View>
                          <View>
                            <Text style={{ fontFamily: FONTS.medium, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Spent</Text>
                            <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: spent > 0 ? barColor : colors.textMuted }}>{fmt(spent, currency)}</Text>
                          </View>
                          <View>
                            <Text style={{ fontFamily: FONTS.medium, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>{overBudget ? 'Over' : 'Left'}</Text>
                            <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: overBudget ? colors.danger : colors.success }}>
                              {fmt(Math.abs(remaining), currency)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {cats.length === 0 && (
                        <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted, textAlign: 'right', maxWidth: 70 }}>
                          No tracked category
                        </Text>
                      )}
                    </View>
                    <View style={[s.bucketBarTrack, { marginTop: 12, height: 5, borderRadius: 3 }]}>
                      <View style={[s.bucketBarFill, { width: `${Math.min(ratio * 100, 100)}%` as any, backgroundColor: barColor, height: 5, borderRadius: 3 }]} />
                    </View>
                    {overBudget && (
                      <Text style={{ fontFamily: FONTS.medium, fontSize: 11, color: colors.danger, marginTop: 4 }}>
                        Over budget by {fmt(Math.abs(remaining), currency)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Plan view (existing) ─────────────────────────── */}
      {viewMode === 'plan' && <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── Summary Card ─────────────────────────────────── */}
          <View style={s.summaryCard}>
            {/* Label row — balance pill sits beside the small label, never beside the big number */}
            <View style={s.summaryTop}>
              <Text style={s.summaryLabel}>TOTAL INCOME</Text>
              <View style={[
                s.remainingPill,
                { backgroundColor: isBalanced ? colors.emeraldBg : remaining > 0 ? colors.warningBg : colors.dangerBg },
              ]}>
                <Ionicons
                  name={isBalanced ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={13}
                  color={isBalanced ? colors.emerald : remaining > 0 ? colors.warning : colors.danger}
                />
                <Text style={[s.remainingText, { color: isBalanced ? colors.emerald : remaining > 0 ? colors.warning : colors.danger }]}>
                  {isBalanced ? 'Balanced ✓' : remaining > 0 ? `${fmt(remaining, currency)} left` : `${fmt(Math.abs(remaining), currency)} over`}
                </Text>
              </View>
            </View>
            {/* Big income number on its own line — no competition for space */}
            <Text style={s.summaryTotal}>{fmt(totalIncome, currency)}</Text>

            {/* Donut chart + legend */}
            <View style={s.donutRow}>
              <DonutChart
                segments={buckets.map((b) => ({ value: b.amount, color: b.color, label: b.name }))}
                size={120}
                strokeWidth={18}
                centerLabel={`${allocPct}%`}
                centerSub="allocated"
                colors={colors}
              />
              <View style={s.legendCol}>
                {buckets.filter((b) => b.amount > 0).map((b) => (
                  <View key={b.name} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: b.color }]} />
                    <Text style={s.legendLabel} numberOfLines={1}>
                      {b.name.length > 12 ? b.name.slice(0, 12) + '…' : b.name}{' '}
                      <Text style={{ color: b.color }}>
                        {totalIncome > 0 ? Math.round((b.amount / totalIncome) * 100) : 0}%
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {!isBalanced && Math.abs(remaining) < totalIncome * 0.2 && (
              <TouchableOpacity style={s.autoBalanceBtn} onPress={autoBalance}>
                <Ionicons name="git-merge-outline" size={14} color={colors.gold} />
                <Text style={s.autoBalanceText}>Auto-balance ({remaining > 0 ? '+' : '-'}{fmt(Math.abs(remaining), currency)} → Savings)</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Bucket Cards ─────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Budget Buckets</Text>
              <TouchableOpacity style={s.addBucketBtn} onPress={() => setShowAddBucket(true)} activeOpacity={0.8}>
                <Ionicons name="add" size={16} color={colors.gold} />
                <Text style={s.addBucketTxt}>Add</Text>
              </TouchableOpacity>
            </View>

            {buckets.map((bucket, i) => {
              const pct = totalIncome > 0 ? Number(((bucket.amount / totalIncome) * 100).toFixed(1)) : 0;
              const threshold = getThreshold(bucket.name, pct);
              const isFocused = focusedBucket === bucket.name;

              const statusColor = threshold?.status === 'success' ? colors.success
                : threshold?.status === 'warning' ? colors.warning : colors.danger;

              return (
                <View
                  key={bucket.name}
                  style={[s.bucketCard, i > 0 && s.mt10]}
                  onLayout={(e) => { cardOffsets.current[bucket.name] = e.nativeEvent.layout.y; }}
                >
                  <View style={s.bucketTop}>
                    <View style={[s.bucketIconWrap, { backgroundColor: bucket.color + '22', borderColor: bucket.color + '44' }]}>
                      <Ionicons name={bucket.icon as any} size={20} color={bucket.color} />
                    </View>
                    <View style={s.bucketNameCol}>
                      <View style={s.bucketNameRow}>
                        <Text style={s.bucketName}>{bucket.name}</Text>
                        {threshold && (
                          <View style={[s.thresholdDot, { backgroundColor: statusColor }]} />
                        )}
                      </View>
                      {threshold && (
                        <Text style={[s.thresholdInline, { color: colors.textMuted }]}>{threshold.message}</Text>
                      )}
                      <Text style={[s.bucketPct, { color: bucket.color }]}>{pct}% of income</Text>
                    </View>
                    <View style={[s.amountWrap, isFocused && { borderColor: bucket.color, borderWidth: 2 }]}>
                      <Text style={[s.currencySign, isFocused && { color: bucket.color }]}>
                        {CURRENCIES[currency].symbol}
                      </Text>
                      <TextInput
                        style={[s.amountInput, { color: isFocused ? colors.textPrimary : colors.textPrimary }]}
                        value={bucket.amount > 0 ? formatInput(bucket.amount.toString()) : ''}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        onChangeText={(v) => updateAmount(bucket.name, v)}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        onFocus={() => handleFocus(bucket.name)}
                        onBlur={() => setFocusedBucket(null)}
                        selectTextOnFocus
                        cursorColor={bucket.color}
                        selectionColor={bucket.color + '55'}
                      />
                    </View>
                    {bucket.isCustom && (
                      <TouchableOpacity
                        style={s.removeBucketBtn}
                        onPress={() => removeCustomBucket(bucket.name)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={[s.bucketBarTrack, { marginTop: 10 }]}>
                    <View style={[s.bucketBarFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: bucket.color }]} />
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={s.addBucketCard} onPress={() => setShowAddBucket(true)} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={20} color={colors.gold} />
              <Text style={s.addBucketCardTxt}>Add a custom bucket</Text>
            </TouchableOpacity>
            <Text style={s.allocationQuote}>
              {'"Give every naira a name — Steward budgeting principle"'}
            </Text>
          </View>
      </ScrollView>}

      <AddBucketModal
        visible={showAddBucket}
        onClose={() => setShowAddBucket(false)}
        onAdd={addCustomBucket}
        totalIncome={totalIncome}
        existingNames={existingNames}
        colors={colors}
        isDark={isDark}
      />

      {/* ── Monthly Reset Sheet ─────────────────────────────── */}
      <BottomSheetModal
        ref={resetSheetRef}
        enableDynamicSizing
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
        backgroundStyle={{ backgroundColor: colors.card, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      >
        <View style={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 }}>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 6 }}>
            New Month 🗓
          </Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 24 }}>
            {monthLabel} has no plan yet. How would you like to start?
          </Text>

          {[
            {
              key: 'copy' as const,
              icon: 'copy-outline',
              title: "Copy last month's plan",
              sub: 'Duplicate your previous allocation amounts',
            },
            {
              key: 'suggested' as const,
              icon: 'bulb-outline',
              title: 'Use suggested percentages',
              sub: "Apply Steward's recommended budget split",
            },
            {
              key: 'fresh' as const,
              icon: 'refresh-outline',
              title: 'Start fresh',
              sub: 'Begin with all buckets at zero',
            },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: colors.surface, borderRadius: 14,
                padding: 16, marginBottom: 10,
                borderWidth: 1, borderColor: colors.border,
              }}
              onPress={() => applyResetOption(opt.key)}
              activeOpacity={0.8}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.burgundy + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={opt.icon as any} size={20} color={colors.burgundy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary, marginBottom: 2 }}>{opt.title}</Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>{opt.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingBottom: 40 },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14,
    },
    headerTitle: { fontFamily: FONTS.heading, fontSize: 24, color: colors.textPrimary, marginBottom: 2 },
    headerSub: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary },

    saveBtn: {
      backgroundColor: colors.gold, borderRadius: 12,
      paddingHorizontal: 20, paddingVertical: 9, minWidth: 70, alignItems: 'center',
    },
    saveBtnDone: { backgroundColor: colors.emerald },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { fontFamily: FONTS.semibold, fontSize: 14, color: isDark ? colors.bg : '#FFF' },

    summaryCard: {
      margin: 20, marginBottom: 8,
      backgroundColor: colors.card, borderRadius: 24,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border, padding: 18,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 8, elevation: isDark ? 0 : 3,
    },
    summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    summaryLabel: { fontFamily: FONTS.semibold, fontSize: 10, color: colors.gold + 'B3', letterSpacing: 1, textTransform: 'uppercase' },
    summaryTotal: { fontFamily: FONTS.headingItalic, fontSize: 44, color: colors.textPrimary, letterSpacing: -1, marginBottom: 16 },

    remainingPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8,
    },
    remainingText: { fontFamily: FONTS.semibold, fontSize: 13 },

    donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
    legendCol: { flex: 1, gap: 5 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
    legendLabel: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, flex: 1 },

    autoBalanceBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
      backgroundColor: colors.goldBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    },
    autoBalanceText: { fontFamily: FONTS.medium, fontSize: 12, color: colors.gold },

    section: { paddingHorizontal: 20, marginTop: 16, marginBottom: 20 },
    sectionHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
    },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary },
    mt10: { marginTop: 10 },

    addBucketBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.goldBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    },
    addBucketTxt: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold },

    bucketCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border, padding: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 2,
    },
    bucketTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bucketIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: 1 },
    bucketNameCol: { flex: 1, minWidth: 0 },
    bucketNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
    bucketName: { fontFamily: FONTS.headingItalic, fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
    thresholdDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 5, flexShrink: 0 },
    thresholdInline: { fontFamily: FONTS.regular, fontSize: 11, marginBottom: 1, color: colors.textMuted },
    bucketPct: { fontFamily: FONTS.medium, fontSize: 11 },

    amountWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1.5, borderColor: colors.border,
      paddingHorizontal: 10, paddingVertical: 11,
      width: 118, flexShrink: 0,
    },
    currencySign: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textMuted, marginRight: 3 },
    amountInput: {
      fontFamily: FONTS.semibold, fontSize: 16,
      flex: 1, textAlign: 'right',
      color: colors.textPrimary,
      includeFontPadding: false,
      textAlignVertical: 'center',
      padding: 0,
    },

    removeBucketBtn: { marginLeft: 8 },

    addBucketCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginTop: 10, borderRadius: 16,
      borderWidth: 1.5, borderColor: colors.gold + '55',
      borderStyle: 'dashed', padding: 18, justifyContent: 'center',
    },
    addBucketCardTxt: { fontFamily: FONTS.medium, fontSize: 14, color: colors.gold },

    modeToggle: {
      flexDirection: 'row', marginHorizontal: 20, marginBottom: 4,
      backgroundColor: colors.surface, borderRadius: 12, padding: 3,
    },
    modeBtn: {
      flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    },
    modeBtnActive: { backgroundColor: colors.burgundy },
    modeBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textMuted },
    modeBtnTextActive: { color: colors.gold },

    bucketBarTrack: { height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
    bucketBarFill: { height: 3, borderRadius: 2 },

    allocationQuote: {
      fontFamily: FONTS.headingItalic, fontSize: 12,
      color: colors.textMuted, textAlign: 'center',
      marginTop: 16, paddingHorizontal: 20, lineHeight: 18,
    },
  });
}
