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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
        <BottomSheetTextInput
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
        <BottomSheetTextInput
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

// ─── Keyboard Done Bar ────────────────────────────────────────────────────────
function KeyboardDoneBar({ visible, colors }: { visible: boolean; colors: any }) {
  if (!visible) return null;
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      borderRadius: 0,
    }}>
      <TouchableOpacity
        onPress={Keyboard.dismiss}
        style={{
          backgroundColor: colors.gold,
          borderRadius: 20,
          paddingHorizontal: 24,
          paddingVertical: 10,
        }}
      >
        <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: '#FFF' }}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AllocationScreen() {
  const { colors, isDark } = useTheme();
  const { user, household, currency } = useAuth();
  const insets = useSafeAreaInsets();

  const [totalIncome, setTotalIncome] = useState(0);
  const [buckets, setBuckets] = useState<BucketState[]>(
    BUCKET_DEFAULTS.map((b) => ({ name: b.name, icon: b.icon, color: b.color, amount: 0 }))
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [focusedBucket, setFocusedBucket] = useState<string | null>(null);
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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
      setBuckets(
        BUCKET_DEFAULTS.map((b) => ({
          name: b.name, icon: b.icon, color: b.color,
          amount: Math.round((income * b.defaultPct) / 100),
          isCustom: false,
        }))
      );
    }
    setLoading(false);
  }, [user, household, month, year]);

  useEffect(() => { load(); }, [load]);

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
      </View>

      {/* Keyboard Done bar (shows above keyboard on both platforms) */}
      <KeyboardDoneBar visible={keyboardVisible} colors={colors} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── Summary Card ─────────────────────────────────── */}
          <View style={s.summaryCard}>
            <View style={s.summaryTop}>
              <View>
                <Text style={s.summaryLabel}>TOTAL INCOME</Text>
                <Text style={s.summaryTotal}>{fmt(totalIncome, currency)}</Text>
              </View>
              <View style={[
                s.remainingPill,
                { backgroundColor: isBalanced ? colors.emeraldBg : remaining > 0 ? colors.warningBg : colors.dangerBg },
              ]}>
                <Ionicons
                  name={isBalanced ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={14}
                  color={isBalanced ? colors.emerald : remaining > 0 ? colors.warning : colors.danger}
                />
                <Text style={[s.remainingText, { color: isBalanced ? colors.emerald : remaining > 0 ? colors.warning : colors.danger }]}>
                  {isBalanced ? 'Balanced ✓' : remaining > 0 ? `${fmt(remaining, currency)} left` : `${fmt(Math.abs(remaining), currency)} over`}
                </Text>
              </View>
            </View>

            <View style={s.stackedBar}>
              {buckets.map((b, i) => (
                <View key={b.name} style={[s.stackedSeg, { flex: totalIncome > 0 ? b.amount / totalIncome * 100 : 1, backgroundColor: b.color }, i > 0 && { marginLeft: 2 }]} />
              ))}
            </View>

            <View style={s.legendRow}>
              {buckets.map((b) => (
                <View key={b.name} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: b.color }]} />
                  <Text style={s.legendLabel}>
                    {b.name.slice(0, 3)} {totalIncome > 0 ? Math.round((b.amount / totalIncome) * 100) : 0}%
                  </Text>
                </View>
              ))}
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
                    <View style={[s.bucketIconWrap, { backgroundColor: bucket.color + '22' }]}>
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
                </View>
              );
            })}

            <TouchableOpacity style={s.addBucketCard} onPress={() => setShowAddBucket(true)} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={20} color={colors.gold} />
              <Text style={s.addBucketCardTxt}>Add a custom bucket</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AddBucketModal
        visible={showAddBucket}
        onClose={() => setShowAddBucket(false)}
        onAdd={addCustomBucket}
        totalIncome={totalIncome}
        existingNames={existingNames}
        colors={colors}
        isDark={isDark}
      />
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
    summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    summaryLabel: { fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    summaryTotal: { fontFamily: FONTS.display, fontSize: 36, color: colors.textPrimary, letterSpacing: -1 },

    remainingPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8,
    },
    remainingText: { fontFamily: FONTS.semibold, fontSize: 13 },

    stackedBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 8 },
    stackedSeg: { height: 14, borderRadius: 2 },

    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    legendLabel: { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted },

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
    bucketTop: { flexDirection: 'row', alignItems: 'center' },
    bucketIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    bucketNameCol: { flex: 1 },
    bucketNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    bucketName: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary },
    thresholdDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
    thresholdInline: { fontFamily: FONTS.regular, fontSize: 12, marginBottom: 2 },
    bucketPct: { fontFamily: FONTS.medium, fontSize: 11 },

    amountWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1.5, borderColor: colors.border,
      paddingHorizontal: 10, paddingVertical: 12, minWidth: 110,
    },
    currencySign: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.textMuted, marginRight: 4 },
    amountInput: {
      fontFamily: FONTS.semibold, fontSize: 17,
      flex: 1, minWidth: 70, textAlign: 'right',
      color: colors.textPrimary,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },

    removeBucketBtn: { marginLeft: 8 },

    addBucketCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginTop: 10, borderRadius: 16,
      borderWidth: 1.5, borderColor: colors.gold + '55',
      borderStyle: 'dashed', padding: 18, justifyContent: 'center',
    },
    addBucketCardTxt: { fontFamily: FONTS.medium, fontSize: 14, color: colors.gold },
  });
}
