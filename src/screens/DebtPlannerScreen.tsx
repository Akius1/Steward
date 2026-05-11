import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt, CURRENCIES, formatInput, parseInput } from '@/utils/currency';

interface Debt {
  id: string;
  name: string;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
}

interface PayoffResult {
  months: number;
  totalInterest: number;
  totalPaid: number;
  order: string[];
}

// ─── Payoff Engine ────────────────────────────────────────────────────────────
function calcPayoff(debts: Debt[], extraPayment: number, method: 'avalanche' | 'snowball'): PayoffResult {
  if (!debts.length) return { months: 0, totalInterest: 0, totalPaid: 0, order: [] };

  const sorted = [...debts].sort((a, b) =>
    method === 'avalanche'
      ? b.interest_rate - a.interest_rate   // highest APR first
      : a.balance - b.balance               // lowest balance first
  );

  const remaining = sorted.map((d) => ({ ...d, balance: d.balance, paid: 0, interest: 0 }));
  let months = 0;
  let totalInterest = 0;
  const MAX_MONTHS = 600; // 50 years safety cap

  while (remaining.some((d) => d.balance > 0.01) && months < MAX_MONTHS) {
    months++;

    // 1. Accrue monthly interest on each remaining balance
    for (const d of remaining) {
      if (d.balance <= 0) continue;
      const monthlyRate = d.interest_rate / 100 / 12;
      const interest = d.balance * monthlyRate;
      d.interest += interest;
      totalInterest += interest;
      d.balance += interest;
    }

    // 2. Pay minimums on all debts
    for (const d of remaining) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.balance, d.minimum_payment);
      d.balance -= pay;
      d.paid += pay;
    }

    // 3. Apply extra payment to the priority debt (first non-zero by method order)
    let extra = extraPayment;
    for (const d of remaining) {
      if (d.balance <= 0 || extra <= 0) continue;
      const pay = Math.min(d.balance, extra);
      d.balance -= pay;
      d.paid += pay;
      extra -= pay;
      if (d.balance < 0.01) d.balance = 0;
    }

    // Clamp negatives
    for (const d of remaining) { if (d.balance < 0) d.balance = 0; }
  }

  const totalPaid = remaining.reduce((s, d) => s + d.paid, 0);
  const order = sorted.map((d) => d.name);

  return { months, totalInterest: Math.round(totalInterest), totalPaid: Math.round(totalPaid), order };
}

function monthsToLabel(months: number) {
  if (months >= 600) return 'Over 50 years';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
  return `${y}yr ${m}mo`;
}

// ─── Add Debt Modal ───────────────────────────────────────────────────────────
function AddDebtModal({ visible, onClose, onAdd, currency, colors, isDark }: {
  visible: boolean; onClose: () => void;
  onAdd: (d: Omit<Debt, 'id'>) => void;
  currency: string; colors: any; isDark: boolean;
}) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [rate, setRate] = useState('');
  const [minPay, setMinPay] = useState('');

  const sym = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? '₦';

  function handleAdd() {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    const b = parseInput(balance);
    const r = parseFloat(rate.replace(',', '.'));
    const m = parseInput(minPay);
    if (b <= 0) { Alert.alert('Enter a valid balance'); return; }
    if (isNaN(r) || r < 0 || r > 200) { Alert.alert('Enter a valid annual interest rate (0–200%)'); return; }
    if (m < 0) { Alert.alert('Enter a valid minimum payment'); return; }
    onAdd({ name: name.trim(), balance: b, interest_rate: r, minimum_payment: m });
    setName(''); setBalance(''); setRate(''); setMinPay('');
    onClose();
  }

  const iStyle = {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: FONTS.medium, fontSize: 15, color: colors.textPrimary,
  };
  const lStyle = {
    fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 6, marginTop: 14,
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ justifyContent: 'flex-end' }}
        >
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            {/* Drag handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />

            <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 4 }}>Add a Debt</Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
              Enter the details below to start tracking this debt.
            </Text>

            <Text style={lStyle}>DEBT NAME</Text>
            <TextInput style={iStyle} placeholder="e.g. Car Loan, Credit Card" placeholderTextColor={colors.textMuted}
              value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />

            <Text style={lStyle}>OUTSTANDING BALANCE ({sym})</Text>
            <TextInput style={iStyle} placeholder="0" placeholderTextColor={colors.textMuted}
              value={balance} onChangeText={setBalance} keyboardType="numeric" returnKeyType="next" />

            <Text style={lStyle}>ANNUAL INTEREST RATE (%)</Text>
            <TextInput style={iStyle} placeholder="e.g. 24" placeholderTextColor={colors.textMuted}
              value={rate} onChangeText={setRate} keyboardType="decimal-pad" returnKeyType="next" />

            <Text style={lStyle}>MINIMUM MONTHLY PAYMENT ({sym})</Text>
            <TextInput style={iStyle} placeholder="0" placeholderTextColor={colors.textMuted}
              value={minPay} onChangeText={setMinPay} keyboardType="numeric" returnKeyType="done"
              onSubmitEditing={handleAdd} />

            <TouchableOpacity
              style={{ backgroundColor: colors.burgundy, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 }}
              onPress={handleAdd} activeOpacity={0.85}
            >
              <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: colors.gold }}>Add Debt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 14 }} onPress={onClose}>
              <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textMuted }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Session-level cache (survives tab switches) ──────────────────────────────
let _cachedDebts: Debt[] = [];
let _cachedDebtsUserId = '';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DebtPlannerScreen() {
  const { colors, isDark } = useTheme();
  const { user, household, currency } = useAuth();
  const router = useRouter();

  // Clear cache if different user
  if (_cachedDebtsUserId && _cachedDebtsUserId !== (user?.id ?? '')) {
    _cachedDebts = [];
    _cachedDebtsUserId = '';
  }

  const [debts, setDebts] = useState<Debt[]>(_cachedDebts);
  const [extraPayment, setExtraPayment] = useState('');
  const [method, setMethod] = useState<'avalanche' | 'snowball'>('avalanche');
  const [showAdd, setShowAdd] = useState(false);
  // Skip loading spinner if we already have cached debts
  const [loading, setLoading] = useState(_cachedDebts.length === 0);

  const extra = parseInput(extraPayment) || 0;
  const sym = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? '₦';

  const avalanche = useMemo(() => calcPayoff(debts, extra, 'avalanche'), [debts, extra]);
  const snowball  = useMemo(() => calcPayoff(debts, extra, 'snowball'),  [debts, extra]);
  const active    = method === 'avalanche' ? avalanche : snowball;
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);

  const setDebtsCached = (updater: Debt[] | ((prev: Debt[]) => Debt[])) => {
    setDebts((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      _cachedDebts = next;
      return next;
    });
  };

  // ── Load debts from Supabase on mount ────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    // Always query by user_id — simpler, no household mismatch risk
    const db = supabase as any;
    db.from('debts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }: { data: any; error: any }) => {
        if (!error && data) {
          const mapped: Debt[] = data.map((r: any) => ({
            id: r.id,
            name: r.name,
            balance: Number(r.balance),
            interest_rate: Number(r.interest_rate),
            minimum_payment: Number(r.minimum_payment),
          }));
          _cachedDebts = mapped;
          _cachedDebtsUserId = user.id;
          setDebts(mapped);
        }
        setLoading(false);
      });
  }, [user?.id]);

  async function addDebt(d: Omit<Debt, 'id'>) {
    if (!user) return;
    const db = supabase as any;
    const { data, error } = await db.from('debts').insert({
      user_id: user.id,
      name: d.name,
      balance: d.balance,
      interest_rate: d.interest_rate,
      minimum_payment: d.minimum_payment,
    }).select().single();
    if (error) {
      Alert.alert('Error', 'Could not save debt. Please try again.');
      console.error('[Debts] insert error:', error.message);
      return;
    }
    setDebtsCached((prev) => [...prev, {
      id: data.id,
      name: data.name,
      balance: Number(data.balance),
      interest_rate: Number(data.interest_rate),
      minimum_payment: Number(data.minimum_payment),
    }]);
    _cachedDebtsUserId = user.id;
  }

  function removeDebt(id: string) {
    Alert.alert('Remove debt', 'Remove this debt from your planner?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const db = supabase as any;
          const { error } = await db.from('debts').delete().eq('id', id);
          if (error) {
            Alert.alert('Error', 'Could not remove debt. Please try again.');
            return;
          }
          setDebtsCached((prev) => prev.filter((d) => d.id !== id));
        },
      },
    ]);
  }

  const s = makeStyles(colors, isDark);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ──────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.headerTitle}>Debt Payoff Planner</Text>
          <Text style={s.headerSub}>Avalanche & Snowball calculator</Text>
        </View>
        <TouchableOpacity
          style={[s.addBtn]}
          onPress={() => setShowAdd(true)} activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color={colors.gold} />
          <Text style={s.addBtnTxt}>Add Debt</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }} style={loading ? { display: 'none' } : undefined}>

        {/* ── Hero summary card ────────────────────────────── */}
        <LinearGradient
          colors={isDark ? ['#2e1413', '#4E0B0B'] : ['#7B1515', '#4E0B0B']}
          style={s.heroCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Text style={s.heroLabel}>TOTAL DEBT</Text>
          <Text style={s.heroAmount}>{fmt(totalDebt, currency)}</Text>
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 16 }}>
            <View>
              <Text style={s.heroStatLabel}>Debts</Text>
              <Text style={s.heroStatVal}>{debts.length}</Text>
            </View>
            <View>
              <Text style={s.heroStatLabel}>Payoff Time</Text>
              <Text style={s.heroStatVal}>{debts.length ? monthsToLabel(active.months) : '—'}</Text>
            </View>
            <View>
              <Text style={s.heroStatLabel}>Total Interest</Text>
              <Text style={s.heroStatVal}>{debts.length ? fmt(active.totalInterest, currency) : '—'}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Method toggle ────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Strategy</Text>
          <View style={s.methodRow}>
            {([
              { key: 'avalanche', icon: 'flame-outline', label: 'Avalanche', sub: 'Highest interest first · saves most money' },
              { key: 'snowball',  icon: 'snow-outline',  label: 'Snowball',  sub: 'Lowest balance first · fastest wins' },
            ] as const).map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[s.methodCard, method === m.key && { borderColor: colors.burgundy, backgroundColor: isDark ? '#2e1413' : '#fdf5f5' }]}
                onPress={() => setMethod(m.key)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ionicons name={m.icon} size={16} color={method === m.key ? colors.burgundy : colors.textMuted} />
                  <Text style={[s.methodLabel, method === m.key && { color: colors.burgundy }]}>{m.label}</Text>
                  {method === m.key && (
                    <Ionicons name="checkmark-circle" size={14} color={colors.burgundy} style={{ marginLeft: 'auto' }} />
                  )}
                </View>
                <Text style={s.methodSub}>{m.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Extra monthly payment ─────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Extra Monthly Payment</Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginBottom: 10 }}>
            Any amount above minimums accelerates payoff dramatically.
          </Text>
          <View style={[s.extraInput, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[s.extraSym, { color: colors.textMuted }]}>{sym}</Text>
            <TextInput
              style={[s.extraField, { color: colors.textPrimary }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={extraPayment}
              onChangeText={setExtraPayment}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* ── Comparison card ──────────────────────────────── */}
        {debts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Method Comparison</Text>
            <View style={[s.compCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: 'Strategy', av: 'Avalanche', sn: 'Snowball' },
                { label: 'Payoff time', av: monthsToLabel(avalanche.months), sn: monthsToLabel(snowball.months) },
                { label: 'Interest paid', av: fmt(avalanche.totalInterest, currency), sn: fmt(snowball.totalInterest, currency) },
              ].map((row, i) => (
                <View key={row.label}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: colors.border }} />}
                  <View style={s.compRow}>
                    <Text style={s.compLabel}>{row.label}</Text>
                    <Text style={[s.compVal, { color: colors.burgundy }]}>{row.av}</Text>
                    <Text style={[s.compVal, { color: colors.textMuted }]}>{row.sn}</Text>
                  </View>
                </View>
              ))}
              {avalanche.totalInterest < snowball.totalInterest && (
                <View style={[s.savingsBadge, { backgroundColor: colors.emeraldBg }]}>
                  <Ionicons name="trending-down-outline" size={13} color={colors.emerald} />
                  <Text style={[s.savingsBadgeTxt, { color: colors.emerald }]}>
                    Avalanche saves {fmt(snowball.totalInterest - avalanche.totalInterest, currency)} in interest
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Debt list ────────────────────────────────────── */}
        <View style={s.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={s.sectionTitle}>Your Debts</Text>
            {method === 'avalanche' && debts.length > 0 && (
              <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }}>Highest APR first</Text>
            )}
          </View>

          {debts.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="card-outline" size={40} color={colors.textMuted} />
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No debts added yet</Text>
              <Text style={[s.emptySub, { color: colors.textMuted }]}>
                Add your loans, credit cards or any outstanding balance to see your payoff plan.
              </Text>
              <TouchableOpacity
                style={[s.emptyBtn, { backgroundColor: colors.burgundy }]}
                onPress={() => setShowAdd(true)}
              >
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.gold }}>Add First Debt</Text>
              </TouchableOpacity>
            </View>
          ) : (
            [...debts]
              .sort((a, b) => method === 'avalanche'
                ? b.interest_rate - a.interest_rate
                : a.balance - b.balance)
              .map((debt, i) => {
                const priority = i === 0;
                return (
                  <View
                    key={debt.id}
                    style={[s.debtCard, { backgroundColor: colors.card, borderColor: priority ? colors.burgundy : colors.border }, i > 0 && { marginTop: 10 }]}
                  >
                    {priority && (
                      <View style={[s.priorityBadge, { backgroundColor: colors.burgundy }]}>
                        <Text style={{ fontFamily: FONTS.semibold, fontSize: 9, color: colors.gold, letterSpacing: 1 }}>
                          PAYING FIRST
                        </Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.debtName, { color: colors.textPrimary }]}>{debt.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                          <View>
                            <Text style={s.debtMetaLabel}>Balance</Text>
                            <Text style={[s.debtMetaVal, { color: colors.textPrimary }]}>{fmt(debt.balance, currency)}</Text>
                          </View>
                          <View>
                            <Text style={s.debtMetaLabel}>APR</Text>
                            <Text style={[s.debtMetaVal, { color: debt.interest_rate > 20 ? colors.danger : colors.textPrimary }]}>
                              {debt.interest_rate}%
                            </Text>
                          </View>
                          <View>
                            <Text style={s.debtMetaLabel}>Min. Pay</Text>
                            <Text style={[s.debtMetaVal, { color: colors.textPrimary }]}>{fmt(debt.minimum_payment, currency)}</Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => removeDebt(debt.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
          )}
        </View>
      </ScrollView>

      <AddDebtModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addDebt}
        currency={currency}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: colors.textPrimary },
    headerSub: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 1 },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.goldBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    },
    addBtnTxt: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold },

    heroCard: { margin: 20, borderRadius: 20, padding: 22 },
    heroLabel: { fontFamily: FONTS.semibold, fontSize: 10, color: 'rgba(212,175,55,0.7)', letterSpacing: 2, marginBottom: 4 },
    heroAmount: { fontFamily: FONTS.display, fontSize: 40, color: '#FFF', letterSpacing: -1 },
    heroStatLabel: { fontFamily: FONTS.regular, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 2 },
    heroStatVal: { fontFamily: FONTS.semibold, fontSize: 15, color: 'rgba(255,255,255,0.90)' },

    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary, marginBottom: 10 },

    methodRow: { gap: 10 },
    methodCard: {
      borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.card, padding: 14,
    },
    methodLabel: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary },
    methodSub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },

    extraInput: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 6,
    },
    extraSym: { fontFamily: FONTS.semibold, fontSize: 16 },
    extraField: { flex: 1, fontFamily: FONTS.semibold, fontSize: 20, padding: 0, includeFontPadding: false },

    compCard: { borderRadius: 16, borderWidth: isDark ? 1 : 0, overflow: 'hidden' },
    compRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
    compLabel: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: colors.textMuted },
    compVal: { fontFamily: FONTS.semibold, fontSize: 13, minWidth: 100, textAlign: 'right' },
    savingsBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      margin: 12, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    },
    savingsBadgeTxt: { fontFamily: FONTS.medium, fontSize: 12 },

    emptyCard: { borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', padding: 28, alignItems: 'center' },
    emptyTitle: { fontFamily: FONTS.semibold, fontSize: 16, marginTop: 12, marginBottom: 6 },
    emptySub: { fontFamily: FONTS.regular, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    emptyBtn: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },

    debtCard: { borderRadius: 16, borderWidth: 1.5, padding: 16 },
    priorityBadge: {
      alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10,
    },
    debtName: { fontFamily: FONTS.semibold, fontSize: 15 },
    debtMetaLabel: { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
    debtMetaVal: { fontFamily: FONTS.semibold, fontSize: 14 },
  });
}
