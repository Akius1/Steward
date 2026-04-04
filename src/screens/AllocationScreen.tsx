import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BUCKET_DEFAULTS, FONTS } from '@/constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => '₦' + Math.abs(n).toLocaleString('en-NG');

// ─── Types ────────────────────────────────────────────────────────────────────
interface BucketState {
  name: string;
  icon: string;
  color: string;
  amount: number;
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
    default:
      return null;
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AllocationScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [totalIncome, setTotalIncome] = useState(0);
  const [buckets, setBuckets] = useState<BucketState[]>(
    BUCKET_DEFAULTS.map((b) => ({ name: b.name, icon: b.icon, color: b.color, amount: 0 }))
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [focusedBucket, setFocusedBucket] = useState<string | null>(null);

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
  const isBalanced = Math.abs(remaining) < 10; // allow ₦10 rounding tolerance

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get total income from sources
    const { data: sources } = await (supabase as any)
      .from('income_sources')
      .select('amount')
      .eq('user_id', user.id);
    const income = ((sources ?? []) as Array<{ amount: number }>).reduce((s, r) => s + r.amount, 0);
    setTotalIncome(income);

    // Get existing allocations for this month
    const { data: existing } = await (supabase as any)
      .from('allocations')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year);

    if (existing && existing.length > 0) {
      setBuckets((prev) =>
        prev.map((b) => {
          const found = (existing as Array<any>).find((e) => e.bucket_name === b.name);
          return found ? { ...b, amount: found.amount } : b;
        })
      );
    } else if (income > 0) {
      // Seed with default percentages
      setBuckets(
        BUCKET_DEFAULTS.map((b) => ({
          name: b.name,
          icon: b.icon,
          color: b.color,
          amount: Math.round((income * b.defaultPct) / 100),
        }))
      );
    }

    setLoading(false);
  }, [user, month, year]);

  useEffect(() => { load(); }, [load]);

  function updateAmount(bucketName: string, raw: string) {
    const n = parseInt(raw.replace(/[^0-9]/g, '')) || 0;
    setBuckets((prev) => prev.map((b) => (b.name === bucketName ? { ...b, amount: n } : b)));
  }

  async function handleSave() {
    if (!user) return;
    if (totalIncome === 0) {
      Alert.alert('No income', 'Add at least one income source on the Income tab first.');
      return;
    }
    if (!isBalanced) {
      Alert.alert(
        'Allocation incomplete',
        remaining > 0
          ? `You still have ${fmt(remaining)} unallocated. Steward requires 100% allocation.`
          : `You've over-allocated by ${fmt(Math.abs(remaining))}. Reduce a bucket to fix this.`
      );
      return;
    }

    setSaving(true);
    const rows = buckets.map((b) => ({
      user_id: user.id,
      month,
      year,
      bucket_name: b.name,
      amount: b.amount,
      pct: totalIncome > 0 ? Number(((b.amount / totalIncome) * 100).toFixed(2)) : 0,
    }));

    const { error } = await (supabase as any).from('allocations').upsert(rows, {
      onConflict: 'user_id,month,year,bucket_name',
    });
    setSaving(false);

    if (error) {
      Alert.alert('Save failed', error.message);
    } else {
      Alert.alert('Saved ✓', 'Your allocation for ' + monthLabel + ' has been saved.');
    }
  }

  function autoBalance() {
    if (totalIncome === 0) return;
    // Distribute remaining evenly across buckets, or adjust last bucket
    const diff = remaining;
    if (diff === 0) return;
    setBuckets((prev) => {
      const copy = [...prev];
      // Add diff to the largest bucket (savings by default)
      const savingsIdx = copy.findIndex((b) => b.name === 'Savings');
      const target = savingsIdx >= 0 ? savingsIdx : 0;
      copy[target] = { ...copy[target], amount: Math.max(0, copy[target].amount + diff) };
      return copy;
    });
  }

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Fixed Header ─────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Allocation</Text>
            <Text style={s.headerSub}>{monthLabel}</Text>
          </View>
          <TouchableOpacity
            style={[s.saveBtn, (!isBalanced || saving) && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} size="small" />
              : <Text style={s.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Summary Card ─────────────────────────────────── */}
          <View style={s.summaryCard}>
            <View style={s.summaryTop}>
              <View>
                <Text style={s.summaryLabel}>TOTAL INCOME</Text>
                <Text style={s.summaryTotal}>{fmt(totalIncome)}</Text>
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
                <Text style={[
                  s.remainingText,
                  { color: isBalanced ? colors.emerald : remaining > 0 ? colors.warning : colors.danger },
                ]}>
                  {isBalanced ? 'Balanced ✓' : remaining > 0 ? `${fmt(remaining)} left` : `${fmt(remaining)} over`}
                </Text>
              </View>
            </View>

            {/* Stacked allocation bar */}
            <View style={s.stackedBar}>
              {buckets.map((b, i) => (
                <View
                  key={b.name}
                  style={[
                    s.stackedSeg,
                    {
                      flex: totalIncome > 0 ? b.amount / totalIncome * 100 : 1,
                      backgroundColor: b.color,
                    },
                    i > 0 && { marginLeft: 2 },
                  ]}
                />
              ))}
            </View>

            {/* Legend dots */}
            <View style={s.legendRow}>
              {buckets.map((b) => (
                <View key={b.name} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: b.color }]} />
                  <Text style={s.legendLabel}>
                    {totalIncome > 0 ? Math.round((b.amount / totalIncome) * 100) : 0}%
                  </Text>
                </View>
              ))}
            </View>

            {/* Overall progress */}
            <View style={s.progressRow}>
              <View style={s.progressTrack}>
                <View style={[
                  s.progressFill,
                  {
                    width: `${Math.min(allocPct, 100)}%` as any,
                    backgroundColor: isBalanced ? colors.emerald : colors.gold,
                  },
                ]} />
              </View>
              <Text style={[s.progressLabel, { color: isBalanced ? colors.emerald : colors.gold }]}>
                {allocPct}%
              </Text>
            </View>

            {/* Auto-balance shortcut */}
            {!isBalanced && Math.abs(remaining) < totalIncome * 0.2 && (
              <TouchableOpacity style={s.autoBalanceBtn} onPress={autoBalance}>
                <Ionicons name="git-merge-outline" size={14} color={colors.gold} />
                <Text style={s.autoBalanceText}>
                  Auto-balance ({remaining > 0 ? '+' : ''}{fmt(remaining)} → Savings)
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Bucket Cards ─────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Budget Buckets</Text>
            <Text style={s.sectionSubtitle}>Tap any amount to edit · Must total {fmt(totalIncome)}</Text>

            {buckets.map((bucket, i) => {
              const pct = totalIncome > 0 ? Number(((bucket.amount / totalIncome) * 100).toFixed(1)) : 0;
              const threshold = getThreshold(bucket.name, pct);
              const isFocused = focusedBucket === bucket.name;

              const statusIcon = threshold?.status === 'success' ? 'checkmark-circle-outline'
                : threshold?.status === 'warning' ? 'warning-outline'
                : threshold?.status === 'danger' ? 'close-circle-outline'
                : undefined;
              const statusColor = threshold?.status === 'success' ? colors.success
                : threshold?.status === 'warning' ? colors.warning
                : colors.danger;

              return (
                <View key={bucket.name} style={[s.bucketCard, i > 0 && s.mt10]}>
                  <View style={s.bucketTop}>
                    <View style={[s.bucketIconWrap, { backgroundColor: bucket.color + '22' }]}>
                      <Ionicons name={bucket.icon as any} size={20} color={bucket.color} />
                    </View>
                    <View style={s.bucketNameCol}>
                      <Text style={s.bucketName}>{bucket.name}</Text>
                      <Text style={[s.bucketPct, { color: bucket.color }]}>{pct}% of income</Text>
                    </View>
                    <View style={[s.amountWrap, isFocused && { borderColor: bucket.color }]}>
                      <Text style={s.currencySign}>₦</Text>
                      <TextInput
                        style={[s.amountInput, { color: colors.textPrimary }]}
                        value={bucket.amount > 0 ? bucket.amount.toString() : ''}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        onChangeText={(v) => updateAmount(bucket.name, v)}
                        keyboardType="numeric"
                        onFocus={() => setFocusedBucket(bucket.name)}
                        onBlur={() => setFocusedBucket(null)}
                        selectTextOnFocus
                      />
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={s.bucketBarTrack}>
                    <View
                      style={[
                        s.bucketBarFill,
                        { width: `${Math.min(pct, 100)}%` as any, backgroundColor: bucket.color },
                      ]}
                    />
                  </View>

                  {/* Threshold badge */}
                  {threshold && (
                    <View style={[s.thresholdRow, { backgroundColor: (colors as Record<string, string>)[threshold.status + 'Bg'] }]}>
                      {statusIcon && (
                        <Ionicons name={statusIcon} size={12} color={statusColor} />
                      )}
                      <Text style={[s.thresholdText, { color: statusColor }]}>
                        {threshold.message}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: FONTS.heading, fontSize: 24, color: colors.textPrimary, marginBottom: 2 },
    headerSub: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary },

    saveBtn: {
      backgroundColor: colors.gold, borderRadius: 10,
      paddingHorizontal: 20, paddingVertical: 9, minWidth: 70, alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { fontFamily: FONTS.semibold, fontSize: 14, color: isDark ? colors.bg : '#FFF' },

    summaryCard: {
      margin: 20, marginBottom: 8,
      backgroundColor: colors.card, borderRadius: 18,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border, padding: 18,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 8, elevation: isDark ? 0 : 3,
    },
    summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    summaryLabel: { fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    summaryTotal: { fontFamily: FONTS.display, fontSize: 36, color: colors.textPrimary, letterSpacing: -1 },

    remainingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
    remainingText: { fontFamily: FONTS.semibold, fontSize: 12 },

    stackedBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
    stackedSeg: { height: 12, borderRadius: 2 },

    legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    legendLabel: { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted },

    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
    progressTrack: { flex: 1, height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: 5, borderRadius: 3 },
    progressLabel: { fontFamily: FONTS.medium, fontSize: 12, minWidth: 36, textAlign: 'right' },

    autoBalanceBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
      backgroundColor: colors.goldBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    },
    autoBalanceText: { fontFamily: FONTS.medium, fontSize: 12, color: colors.gold },

    section: { paddingHorizontal: 20, marginTop: 16, marginBottom: 20 },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary, marginBottom: 4 },
    sectionSubtitle: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginBottom: 14 },
    mt10: { marginTop: 10 },

    bucketCard: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border, padding: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 2,
    },
    bucketTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    bucketIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    bucketNameCol: { flex: 1 },
    bucketName: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
    bucketPct: { fontFamily: FONTS.medium, fontSize: 11 },

    amountWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 10,
      borderWidth: 1.5, borderColor: colors.border,
      paddingHorizontal: 10, paddingVertical: 8, minWidth: 120,
    },
    currencySign: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textMuted, marginRight: 3 },
    amountInput: { fontFamily: FONTS.semibold, fontSize: 15, flex: 1, minWidth: 80, textAlign: 'right' },

    bucketBarTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
    bucketBarFill: { height: 5, borderRadius: 3 },

    thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6 },
    thresholdText: { fontFamily: FONTS.medium, fontSize: 11, flex: 1 },
  });
}
