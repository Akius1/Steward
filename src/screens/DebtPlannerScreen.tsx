import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import {
  BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { BottomSheetInput } from '@/utils/BottomSheetInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt, CURRENCIES, parseInput } from '@/utils/currency';
import { useToast } from '@/src/components/Toast';
import { ConfirmModal } from '@/src/components/ConfirmModal';

// ─── Types ─────────────────────────────────────────────────────────────────────
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
  debtPayoffMonths: Record<string, number>;
}

// ─── Payoff Engine (with snowball/avalanche rollover) ──────────────────────────
function calcPayoff(debts: Debt[], extraPayment: number, method: 'avalanche' | 'snowball'): PayoffResult {
  if (!debts.length) return { months: 0, totalInterest: 0, totalPaid: 0, order: [], debtPayoffMonths: {} };

  const sorted = [...debts].sort((a, b) =>
    method === 'avalanche' ? b.interest_rate - a.interest_rate : a.balance - b.balance
  );

  const remaining = sorted.map(d => ({ ...d, paid: 0 }));
  const totalMinimums = debts.reduce((s, d) => s + d.minimum_payment, 0);
  let months = 0;
  let totalInterest = 0;
  const debtPayoffMonths: Record<string, number> = {};
  const MAX_MONTHS = 600;

  while (remaining.some(d => d.balance > 0.01) && months < MAX_MONTHS) {
    months++;

    // 1. Accrue monthly interest on every active debt
    for (const d of remaining) {
      if (d.balance <= 0) continue;
      const interest = d.balance * (d.interest_rate / 100 / 12);
      totalInterest += interest;
      d.balance += interest;
    }

    // 2. Pay minimums; track actual amount paid (freed minimums roll over)
    let actualMinsPaid = 0;
    for (const d of remaining) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.balance, d.minimum_payment);
      d.balance -= pay;
      d.paid += pay;
      actualMinsPaid += pay;
    }

    // 3. Freed minimums + extra → priority debt in method order
    let extra = (totalMinimums - actualMinsPaid) + extraPayment;
    for (const d of remaining) {
      if (d.balance <= 0.01 || extra <= 0) continue;
      const pay = Math.min(d.balance, extra);
      d.balance -= pay;
      d.paid += pay;
      extra -= pay;
    }

    // 4. Clamp and record individual payoff month
    for (const d of remaining) {
      if (d.balance < 0) d.balance = 0;
      if (d.balance < 0.01 && !debtPayoffMonths[d.id]) {
        debtPayoffMonths[d.id] = months;
      }
    }
  }

  return {
    months,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(remaining.reduce((s, d) => s + d.paid, 0)),
    order: sorted.map(d => d.name),
    debtPayoffMonths,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function monthsToLabel(months: number): string {
  if (months <= 0) return '—';
  if (months >= 600) return '50+ yrs';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr`;
  return `${y}yr ${m}mo`;
}

function payoffDateLabel(months: number): string {
  if (months <= 0 || months >= 600) return '—';
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function aprInfo(rate: number): { label: string; color: string; bg: string } {
  if (rate > 30) return { label: 'CRITICAL',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
  if (rate > 20) return { label: 'HIGH APR',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
  if (rate > 10) return { label: 'MODERATE',  color: '#D4AF37', bg: 'rgba(212,175,55,0.12)' };
  return           { label: 'LOW APR',   color: '#10B97A', bg: 'rgba(16,185,122,0.12)' };
}

// ─── Session-level cache ───────────────────────────────────────────────────────
let _cachedDebts: Debt[] = [];
let _cachedDebtsUserId = '';

// ─── Debt Form Sheet (Add + Edit) ─────────────────────────────────────────────
function DebtFormSheet({
  visible, editDebt, onClose, onSave, currency, colors, isDark,
}: {
  visible: boolean;
  editDebt: Debt | null;
  onClose: () => void;
  onSave: (data: Omit<Debt, 'id'>, id?: string) => void;
  currency: string;
  colors: any;
  isDark: boolean;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [name, setName]     = useState('');
  const [balance, setBalance] = useState('');
  const [rate, setRate]     = useState('');
  const [minPay, setMinPay] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sym = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? '₦';

  useEffect(() => {
    if (visible) {
      setErrors({});
      if (editDebt) {
        setName(editDebt.name);
        setBalance(String(editDebt.balance));
        setRate(String(editDebt.interest_rate));
        setMinPay(String(editDebt.minimum_payment));
      } else {
        setName(''); setBalance(''); setRate(''); setMinPay('');
      }
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, editDebt?.id]);

  function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Debt name is required';
    const b = parseInput(balance);
    if (b <= 0) errs.balance = 'Enter a valid balance';
    const r = parseFloat(rate.replace(',', '.'));
    if (isNaN(r) || r < 0 || r > 200) errs.rate = 'Enter a valid rate (0–200%)';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    onSave(
      { name: name.trim(), balance: b, interest_rate: r, minimum_payment: parseInput(minPay) },
      editDebt?.id,
    );
  }

  const labelSt = {
    fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 6, marginTop: 16,
  };
  const inputSt = {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: FONTS.medium, fontSize: 15, color: colors.textPrimary,
  };
  const errSt = { fontFamily: FONTS.regular, fontSize: 12, color: '#EF4444', marginTop: 4 };

  return (
    <BottomSheetModal
      ref={sheetRef}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      snapPoints={['62%', '92%']}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
      backgroundStyle={{ backgroundColor: colors.card, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginTop: 8, marginBottom: 2 }}>
          {editDebt ? 'Edit Debt' : 'Add a Debt'}
        </Text>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>
          {editDebt ? 'Update the details for this debt.' : 'Enter the details to start tracking this debt.'}
        </Text>

        <Text style={labelSt}>DEBT NAME</Text>
        <BottomSheetInput
          style={[inputSt, errors.name ? { borderColor: '#EF4444' } : {}]}
          placeholder="e.g. Credit Card, Car Loan, Student Loan"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: '' })); }}
          autoCapitalize="words"
          returnKeyType="next"
        />
        {errors.name ? <Text style={errSt}>{errors.name}</Text> : null}

        <Text style={labelSt}>OUTSTANDING BALANCE ({sym})</Text>
        <BottomSheetInput
          style={[inputSt, errors.balance ? { borderColor: '#EF4444' } : {}]}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={balance}
          onChangeText={t => { setBalance(t); setErrors(e => ({ ...e, balance: '' })); }}
          keyboardType="numeric"
          returnKeyType="next"
        />
        {errors.balance ? <Text style={errSt}>{errors.balance}</Text> : null}

        <Text style={labelSt}>ANNUAL INTEREST RATE (%)</Text>
        <BottomSheetInput
          style={[inputSt, errors.rate ? { borderColor: '#EF4444' } : {}]}
          placeholder="e.g. 24"
          placeholderTextColor={colors.textMuted}
          value={rate}
          onChangeText={t => { setRate(t); setErrors(e => ({ ...e, rate: '' })); }}
          keyboardType="decimal-pad"
          returnKeyType="next"
        />
        {errors.rate ? <Text style={errSt}>{errors.rate}</Text> : null}
        <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
          Find this on your loan statement or card agreement
        </Text>

        <Text style={labelSt}>MINIMUM MONTHLY PAYMENT ({sym})</Text>
        <BottomSheetInput
          style={inputSt}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={minPay}
          onChangeText={setMinPay}
          keyboardType="numeric"
          returnKeyType="done"
        />
        <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
          Enter 0 if there's no fixed minimum
        </Text>

        <TouchableOpacity
          style={{ backgroundColor: colors.burgundy, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 }}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: colors.gold }}>
            {editDebt ? 'Save Changes' : 'Add Debt'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 14 }} onPress={onClose}>
          <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textMuted }}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function DebtPlannerScreen() {
  const { colors, isDark } = useTheme();
  const { user, currency } = useAuth();
  const router = useRouter();
  const { showToast, ToastElement } = useToast();

  if (_cachedDebtsUserId && _cachedDebtsUserId !== (user?.id ?? '')) {
    _cachedDebts = []; _cachedDebtsUserId = '';
  }

  const [debts, setDebts]           = useState<Debt[]>(_cachedDebts);
  const [extraPayment, setExtraPayment] = useState('');
  const [method, setMethod]         = useState<'avalanche' | 'snowball'>('avalanche');
  const [showForm, setShowForm]     = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Debt | null>(null);
  const [loading, setLoading]       = useState(_cachedDebts.length === 0);

  const extra = parseInput(extraPayment) || 0;
  const sym   = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? '₦';

  const avalanche = useMemo(() => calcPayoff(debts, extra, 'avalanche'), [debts, extra]);
  const snowball  = useMemo(() => calcPayoff(debts, extra, 'snowball'),  [debts, extra]);
  const active    = method === 'avalanche' ? avalanche : snowball;
  const noExtra   = useMemo(() => calcPayoff(debts, 0, method), [debts, method]);

  const totalDebt    = debts.reduce((s, d) => s + d.balance, 0);
  const totalMins    = debts.reduce((s, d) => s + d.minimum_payment, 0);
  const totalMonthly = totalMins + extra;

  const priorityDebt = debts.length > 0
    ? [...debts].sort((a, b) =>
        method === 'avalanche' ? b.interest_rate - a.interest_rate : a.balance - b.balance
      )[0]
    : null;

  const sortedByPayoff = useMemo(
    () => [...debts].sort((a, b) =>
      (active.debtPayoffMonths[a.id] ?? 999) - (active.debtPayoffMonths[b.id] ?? 999)
    ),
    [debts, active],
  );

  const interestSaved = Math.max(0, noExtra.totalInterest - active.totalInterest);
  const monthsSaved   = Math.max(0, noExtra.months - active.months);

  const setDebtsCached = (updater: Debt[] | ((prev: Debt[]) => Debt[])) => {
    setDebts(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      _cachedDebts = next;
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    const db = supabase as any;
    db.from('debts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }: any) => {
        if (!error && data) {
          const mapped: Debt[] = data.map((r: any) => ({
            id: r.id, name: r.name,
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

  async function handleSaveDebt(data: Omit<Debt, 'id'>, id?: string) {
    if (!user) return;
    const db = supabase as any;

    if (id) {
      const { error } = await db.from('debts').update({
        name: data.name, balance: data.balance,
        interest_rate: data.interest_rate,
        minimum_payment: data.minimum_payment,
      }).eq('id', id);
      if (error) { showToast({ type: 'error', title: 'Could not update debt' }); return; }
      setDebtsCached(prev => prev.map(d => d.id === id ? { ...d, ...data } : d));
      showToast({ type: 'success', title: 'Debt updated' });
    } else {
      const { data: row, error } = await db.from('debts').insert({
        user_id: user.id,
        name: data.name, balance: data.balance,
        interest_rate: data.interest_rate,
        minimum_payment: data.minimum_payment,
      }).select().single();
      if (error) { showToast({ type: 'error', title: 'Could not add debt. Try again.' }); return; }
      setDebtsCached(prev => [...prev, {
        id: row.id, name: row.name,
        balance: Number(row.balance),
        interest_rate: Number(row.interest_rate),
        minimum_payment: Number(row.minimum_payment),
      }]);
      _cachedDebtsUserId = user.id;
      showToast({ type: 'success', title: 'Debt added' });
    }
    setShowForm(false);
    setEditingDebt(null);
  }

  async function deleteDebt() {
    if (!confirmDelete) return;
    const db = supabase as any;
    const { error } = await db.from('debts').delete().eq('id', confirmDelete.id);
    if (error) { showToast({ type: 'error', title: 'Could not remove debt' }); return; }
    setDebtsCached(prev => prev.filter(d => d.id !== confirmDelete.id));
    showToast({ type: 'success', title: `"${confirmDelete.name}" removed` });
    setConfirmDelete(null);
  }

  const s = makeStyles(colors, isDark);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {ToastElement}

      {/* ── Header ──────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.headerTitle}>Debt Payoff Planner</Text>
          {debts.length > 0 && (
            <Text style={s.headerSub}>
              {debts.length} debt{debts.length !== 1 ? 's' : ''} · {monthsToLabel(active.months)} to freedom
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => { setEditingDebt(null); setShowForm(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color={colors.gold} />
          <Text style={s.addBtnTxt}>Add Debt</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

          {/* ── Hero Card ────────────────────────────────────── */}
          <LinearGradient
            colors={isDark ? ['#2e1413', '#4E0B0B'] : ['#7B1515', '#4E0B0B']}
            style={s.heroCard}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {debts.length > 0 ? (
              <>
                <Text style={s.heroLabel}>DEBT-FREE DATE</Text>
                <Text style={s.heroDate}>{payoffDateLabel(active.months)}</Text>
                <Text style={s.heroSub}>
                  {monthsToLabel(active.months)} from today · {fmt(totalDebt, currency)} total debt
                </Text>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 16 }} />
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.heroStatLabel}>Monthly Commitment</Text>
                    <Text style={s.heroStatVal}>{fmt(totalMonthly, currency)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.heroStatLabel}>Total Interest</Text>
                    <Text style={s.heroStatVal}>{fmt(active.totalInterest, currency)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.heroStatLabel}>Debts Tracked</Text>
                    <Text style={s.heroStatVal}>{debts.length}</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                <View style={s.heroEmptyIcon}>
                  <Ionicons name="trending-down-outline" size={28} color="#D4AF37" />
                </View>
                <Text style={s.heroEmptyTitle}>Start your debt-free journey</Text>
                <Text style={s.heroEmptySub}>
                  Add your debts and we'll calculate the fastest way to pay them off — and exactly how much interest you'll save.
                </Text>
                <TouchableOpacity
                  style={s.heroEmptyBtn}
                  onPress={() => { setEditingDebt(null); setShowForm(true); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={16} color="#210909" />
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: '#210909' }}>Add First Debt</Text>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>

          {debts.length > 0 && (
            <>
              {/* ── This Month's Focus ──────────────────────── */}
              {priorityDebt && (
                <View style={s.section}>
                  <View style={[s.actionCard, { borderColor: colors.gold, backgroundColor: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.05)' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <Ionicons name="flag" size={12} color={colors.gold} />
                      <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: colors.gold, letterSpacing: 1.5 }}>
                        THIS MONTH'S FOCUS
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontFamily: FONTS.heading, fontSize: 18, color: colors.textPrimary, marginBottom: 3 }}>
                          {priorityDebt.name}
                        </Text>
                        <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textSecondary }}>
                          Pay {fmt(priorityDebt.minimum_payment + extra, currency)} this month
                        </Text>
                        {extra > 0 && (
                          <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                            {fmt(priorityDebt.minimum_payment, currency)} min + {fmt(extra, currency)} extra
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={[s.payingFirstBadge, { backgroundColor: colors.burgundy }]}>
                          <Text style={{ fontFamily: FONTS.semibold, fontSize: 9, color: colors.gold, letterSpacing: 0.8 }}>
                            PRIORITY
                          </Text>
                        </View>
                        <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'right' }}>
                          {fmt(Math.round(priorityDebt.balance * priorityDebt.interest_rate / 100 / 12), currency)}/mo{'\n'}in interest
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* ── Strategy ────────────────────────────────── */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>Payoff Strategy</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {([
                    {
                      key: 'avalanche' as const,
                      icon: 'flame-outline' as const,
                      label: 'Avalanche',
                      desc: 'Pay highest interest rate first — saves the most money overall',
                    },
                    {
                      key: 'snowball' as const,
                      icon: 'snow-outline' as const,
                      label: 'Snowball',
                      desc: 'Clear the smallest debt first — builds momentum and motivation',
                    },
                  ]).map(m => (
                    <TouchableOpacity
                      key={m.key}
                      style={[s.stratCard, method === m.key && { borderColor: colors.burgundy, backgroundColor: isDark ? '#2e1413' : '#fdf5f5' }]}
                      onPress={() => setMethod(m.key)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={m.icon} size={14} color={method === m.key ? colors.burgundy : colors.textMuted} />
                          <Text style={[s.stratLabel, method === m.key && { color: colors.burgundy }]}>{m.label}</Text>
                        </View>
                        {method === m.key && <Ionicons name="checkmark-circle" size={15} color={colors.burgundy} />}
                      </View>
                      <Text style={s.stratDesc}>{m.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {avalanche.totalInterest !== snowball.totalInterest && (
                  <View style={[s.infoRow, { backgroundColor: colors.emeraldBg, marginTop: 10 }]}>
                    <Ionicons name="trending-down-outline" size={12} color={colors.emerald} />
                    <Text style={[s.infoTxt, { color: colors.emerald }]}>
                      Avalanche saves {fmt(Math.abs(snowball.totalInterest - avalanche.totalInterest), currency)} more in interest than Snowball
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Extra Monthly Payment ────────────────────── */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>Extra Monthly Payment</Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginBottom: 10 }}>
                  Money above minimums goes straight to your priority debt — even a little makes a big difference.
                </Text>
                <View style={[s.extraInput, { borderColor: extra > 0 ? colors.gold : colors.border, backgroundColor: colors.surface }]}>
                  <Text style={[s.extraSym, { color: colors.textMuted }]}>{sym}</Text>
                  <TextInput
                    style={[s.extraField, { color: colors.textPrimary }]}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={extraPayment}
                    onChangeText={setExtraPayment}
                    keyboardType="numeric"
                  />
                  {extra > 0 && (
                    <TouchableOpacity onPress={() => setExtraPayment('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                {extra > 0 && interestSaved > 0 ? (
                  <View style={[s.infoRow, { backgroundColor: colors.emeraldBg, marginTop: 8 }]}>
                    <Ionicons name="sparkles-outline" size={13} color={colors.emerald} />
                    <Text style={[s.infoTxt, { color: colors.emerald }]}>
                      Saves {fmt(interestSaved, currency)} in interest · debt-free {monthsToLabel(monthsSaved)} sooner
                    </Text>
                  </View>
                ) : extra === 0 ? (
                  <View style={[s.infoRow, { backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.07)', marginTop: 8 }]}>
                    <Ionicons name="bulb-outline" size={13} color={colors.gold} />
                    <Text style={[s.infoTxt, { color: colors.gold }]}>
                      Adding even a small extra amount can cut months off your payoff timeline
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* ── Payoff Order ─────────────────────────────── */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>Payoff Order</Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginBottom: 10 }}>
                  When each debt will be fully cleared, in order.
                </Text>
                <View style={[s.sequenceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {sortedByPayoff.map((debt, i) => {
                    const mo = active.debtPayoffMonths[debt.id];
                    const isFirst = i === 0;
                    const isLast  = i === sortedByPayoff.length - 1;
                    return (
                      <View key={debt.id}>
                        <View style={s.seqRow}>
                          <View style={[s.seqBubble, {
                            backgroundColor: isFirst ? colors.burgundy : colors.surface,
                            borderColor:     isFirst ? colors.burgundy : colors.border,
                          }]}>
                            <Text style={{ fontFamily: FONTS.semibold, fontSize: 11, color: isFirst ? colors.gold : colors.textMuted }}>
                              {i + 1}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary }}>{debt.name}</Text>
                            <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }}>
                              {debt.interest_rate}% APR · {fmt(debt.balance, currency)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: isFirst ? colors.burgundy : colors.textPrimary }}>
                              {payoffDateLabel(mo)}
                            </Text>
                            <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }}>
                              {monthsToLabel(mo)}
                            </Text>
                          </View>
                        </View>
                        {!isLast && (
                          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 46 }} />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* ── Debt Cards ───────────────────────────────── */}
              <View style={s.section}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={s.sectionTitle}>Your Debts</Text>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>
                    {method === 'avalanche' ? 'Highest rate first' : 'Smallest balance first'}
                  </Text>
                </View>

                {[...debts]
                  .sort((a, b) => method === 'avalanche' ? b.interest_rate - a.interest_rate : a.balance - b.balance)
                  .map((debt, i) => {
                    const apr   = aprInfo(debt.interest_rate);
                    const moCost = Math.round(debt.balance * debt.interest_rate / 100 / 12);
                    const pct   = totalDebt > 0 ? (debt.balance / totalDebt) * 100 : 0;
                    const isPriority = i === 0;

                    return (
                      <View
                        key={debt.id}
                        style={[
                          s.debtCard,
                          { backgroundColor: colors.card, borderColor: isPriority ? colors.burgundy : colors.border },
                          i > 0 && { marginTop: 10 },
                        ]}
                      >
                        {/* Top row: APR badge + action buttons */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <View style={[s.aprBadge, { backgroundColor: apr.bg }]}>
                            <Text style={{ fontFamily: FONTS.semibold, fontSize: 9, color: apr.color, letterSpacing: 0.8 }}>
                              {apr.label}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={[s.iconBtn, { backgroundColor: colors.surface }]}
                              onPress={() => { setEditingDebt(debt); setShowForm(true); }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="pencil-outline" size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.iconBtn, { backgroundColor: colors.surface }]}
                              onPress={() => setConfirmDelete(debt)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Debt name */}
                        <Text style={[s.debtName, { color: colors.textPrimary }]}>{debt.name}</Text>

                        {/* Stats row */}
                        <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
                          <View>
                            <Text style={s.metaLabel}>Balance</Text>
                            <Text style={[s.metaVal, { color: colors.textPrimary }]}>{fmt(debt.balance, currency)}</Text>
                          </View>
                          <View>
                            <Text style={s.metaLabel}>Interest Rate</Text>
                            <Text style={[s.metaVal, { color: apr.color }]}>{debt.interest_rate}%</Text>
                          </View>
                          <View>
                            <Text style={s.metaLabel}>Min. Payment</Text>
                            <Text style={[s.metaVal, { color: colors.textPrimary }]}>{fmt(debt.minimum_payment, currency)}</Text>
                          </View>
                        </View>

                        {/* Monthly interest cost */}
                        <View style={[s.costRow, { borderTopColor: colors.border }]}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={13}
                            color={debt.interest_rate > 20 ? '#EF4444' : colors.textMuted}
                          />
                          <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: debt.interest_rate > 20 ? '#EF4444' : colors.textMuted }}>
                            Costs {fmt(moCost, currency)} per month in interest alone
                          </Text>
                        </View>

                        {/* Proportion bar */}
                        {totalDebt > 0 && (
                          <View style={{ marginTop: 10 }}>
                            <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
                              <View style={{
                                height: 4,
                                width: `${Math.round(pct)}%` as any,
                                backgroundColor: isPriority ? colors.burgundy : colors.textMuted,
                                borderRadius: 2, opacity: 0.55,
                              }} />
                            </View>
                            <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted, marginTop: 3 }}>
                              {Math.round(pct)}% of your total debt
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      <DebtFormSheet
        visible={showForm}
        editDebt={editingDebt}
        onClose={() => { setShowForm(false); setEditingDebt(null); }}
        onSave={handleSaveDebt}
        currency={currency}
        colors={colors}
        isDark={isDark}
      />

      <ConfirmModal
        visible={!!confirmDelete}
        icon="trash-outline"
        title={`Remove "${confirmDelete?.name}"?`}
        message="This debt will be permanently deleted from your planner."
        confirmLabel="Remove"
        destructive
        onConfirm={deleteDebt}
        onCancel={() => setConfirmDelete(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: colors.textPrimary },
    headerSub:   { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 1 },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.goldBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    },
    addBtnTxt: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold },

    heroCard:        { margin: 20, borderRadius: 20, padding: 22 },
    heroLabel:       { fontFamily: FONTS.semibold, fontSize: 10, color: 'rgba(212,175,55,0.7)', letterSpacing: 2, marginBottom: 4 },
    heroDate:        { fontFamily: FONTS.display, fontSize: 38, color: '#FFF', letterSpacing: -0.5, marginBottom: 2 },
    heroSub:         { fontFamily: FONTS.regular, fontSize: 13, color: 'rgba(255,255,255,0.55)' },
    heroStatLabel:   { fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 3 },
    heroStatVal:     { fontFamily: FONTS.semibold, fontSize: 14, color: 'rgba(255,255,255,0.90)' },
    heroEmptyIcon:   { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(212,175,55,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    heroEmptyTitle:  { fontFamily: FONTS.heading, fontSize: 20, color: '#FFF', marginBottom: 8, textAlign: 'center' },
    heroEmptySub:    { fontFamily: FONTS.regular, fontSize: 13, color: 'rgba(255,255,255,0.60)', textAlign: 'center', lineHeight: 20, marginBottom: 18, paddingHorizontal: 8 },
    heroEmptyBtn:    { backgroundColor: '#D4AF37', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },

    section:         { paddingHorizontal: 20, marginBottom: 22 },
    sectionTitle:    { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary, marginBottom: 10 },

    actionCard:      { borderRadius: 16, borderWidth: 1.5, padding: 16 },
    payingFirstBadge:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },

    stratCard: {
      flex: 1, borderRadius: 14, borderWidth: 1.5,
      borderColor: colors.border, backgroundColor: colors.card, padding: 14,
    },
    stratLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary },
    stratDesc:  { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, lineHeight: 16 },

    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
    infoTxt: { fontFamily: FONTS.medium, fontSize: 12, flex: 1 },

    extraInput: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 6,
    },
    extraSym:   { fontFamily: FONTS.semibold, fontSize: 16 },
    extraField: { flex: 1, fontFamily: FONTS.semibold, fontSize: 20, padding: 0, includeFontPadding: false },

    sequenceCard: { borderRadius: 16, borderWidth: isDark ? 1 : 0, overflow: 'hidden' },
    seqRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
    seqBubble:    { width: 28, height: 28, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

    debtCard:   { borderRadius: 16, borderWidth: 1.5, padding: 16 },
    aprBadge:   { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
    iconBtn:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    debtName:   { fontFamily: FONTS.semibold, fontSize: 15 },
    metaLabel:  { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
    metaVal:    { fontFamily: FONTS.semibold, fontSize: 14 },
    costRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  });
}
