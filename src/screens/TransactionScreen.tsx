import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { BottomSheetInput } from '@/utils/BottomSheetInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt, formatInput, parseInput } from '@/utils/currency';

// ─── Category Meta ─────────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Salary:        { icon: 'briefcase-outline',           color: '#10B97A' },
  Freelance:     { icon: 'laptop-outline',              color: '#C9943F' },
  Business:      { icon: 'business-outline',            color: '#60A5FA' },
  Gift:          { icon: 'gift-outline',                color: '#A78BFA' },
  'Transfer In': { icon: 'arrow-down-circle-outline',   color: '#34D399' },
  Housing:       { icon: 'home-outline',                color: '#C9943F' },
  Food:          { icon: 'restaurant-outline',          color: '#10B97A' },
  Transport:     { icon: 'car-outline',                 color: '#60A5FA' },
  Shopping:      { icon: 'bag-outline',                 color: '#F472B6' },
  Healthcare:    { icon: 'medkit-outline',              color: '#EF4444' },
  Education:     { icon: 'school-outline',              color: '#A78BFA' },
  Entertainment: { icon: 'musical-notes-outline',       color: '#F59E0B' },
  Savings:       { icon: 'trending-up-outline',         color: '#818CF8' },
  Investment:    { icon: 'stats-chart-outline',         color: '#34D399' },
  Other:         { icon: 'ellipsis-horizontal-outline', color: '#8FA3B5' },
};

const INCOME_CATS = ['Salary', 'Freelance', 'Business', 'Gift', 'Transfer In'];
const EXPENSE_CATS = ['Housing', 'Food', 'Transport', 'Shopping', 'Healthcare', 'Education', 'Entertainment', 'Savings', 'Investment', 'Other'];

// ─── Types ─────────────────────────────────────────────────────────────────────
type FilterType = 'All' | 'Income' | 'Expense';
type TransactionType = 'income' | 'expense';

interface Transaction {
  id: string;
  user_id: string;
  household_id: string | null;
  type: TransactionType;
  amount: number;
  category: string;
  note: string | null;
  date: string; // YYYY-MM-DD
  created_at: string;
}

interface DateGroup {
  dateLabel: string;
  dateKey: string;
  items: Transaction[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function toDateLabel(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dateStr === todayStr) {
    const monthName = today.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    return `Today · ${monthName}`;
  }
  if (dateStr === yesterdayStr) {
    const yd = new Date(dateStr);
    const monthName = yd.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    return `Yesterday · ${monthName}`;
  }
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

function groupByDate(transactions: Transaction[]): DateGroup[] {
  const map: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    if (!map[t.date]) map[t.date] = [];
    map[t.date].push(t);
  }
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((dateKey) => ({
      dateKey,
      dateLabel: toDateLabel(dateKey),
      items: map[dateKey].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
}

function monthLabel(month: number, year: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// ─── TransactionRow ───────────────────────────────────────────────────────────
function TransactionRow({
  item,
  colors,
  isDark,
  currency,
  onLongPress,
}: {
  item: Transaction;
  colors: any;
  isDark: boolean;
  currency: string;
  onLongPress: (id: string) => void;
}) {
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META['Other'];
  const isIncome = item.type === 'income';
  const amountColor = isIncome ? colors.emerald : colors.danger;
  const amountPrefix = isIncome ? '+' : '-';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onLongPress={() => onLongPress(item.id)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      {/* Icon circle */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: meta.color + '22',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ionicons name={meta.icon as any} size={18} color={meta.color} />
      </View>

      {/* Center info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {item.category}
        </Text>
        {!!item.note && (
          <Text
            style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 }}
            numberOfLines={1}
          >
            {item.note}
          </Text>
        )}
      </View>

      {/* Amount */}
      <Text style={{ fontFamily: FONTS.semibold, fontSize: 16, color: amountColor, flexShrink: 0 }}>
        {amountPrefix}{fmt(item.amount, currency as any)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── AddTransactionSheet ──────────────────────────────────────────────────────
function AddTransactionSheet({
  sheetRef,
  colors,
  isDark,
  currency,
  userId,
  householdId,
  onAdded,
}: {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  colors: any;
  isDark: boolean;
  currency: string;
  userId: string;
  householdId: string | null;
  onAdded: () => void;
}) {
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [dateChoice, setDateChoice] = useState<'today' | 'yesterday' | 'other'>('today');
  const [otherDate, setOtherDate] = useState('');
  const [saving, setSaving] = useState(false);

  const cats = txType === 'income' ? INCOME_CATS : EXPENSE_CATS;

  // Reset category when type changes if current category is not valid
  useEffect(() => {
    if (category && !cats.includes(category)) {
      setCategory('');
    }
  }, [txType]);

  function getDateString(): string {
    const today = new Date();
    if (dateChoice === 'today') {
      return today.toISOString().slice(0, 10);
    }
    if (dateChoice === 'yesterday') {
      const yd = new Date(today);
      yd.setDate(today.getDate() - 1);
      return yd.toISOString().slice(0, 10);
    }
    // Parse dd/mm/yyyy
    const parts = otherDate.trim().split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().slice(0, 10);
      }
    }
    return today.toISOString().slice(0, 10);
  }

  function reset() {
    setTxType('expense');
    setAmountText('');
    setCategory('');
    setNote('');
    setDateChoice('today');
    setOtherDate('');
  }

  async function handleSubmit() {
    const amount = parseInput(amountText);
    if (amount <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
      return;
    }
    if (!category) {
      Alert.alert('Category required', 'Pick a category.');
      return;
    }

    setSaving(true);
    const dateStr = getDateString();
    const { error } = await (supabase as any).from('transactions').insert({
      user_id: userId,
      household_id: householdId,
      type: txType,
      amount,
      category,
      note: note.trim() || null,
      date: dateStr,
    });
    setSaving(false);

    if (error) {
      Alert.alert('Failed to save', error.message);
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
    sheetRef.current?.dismiss();
    onAdded();
  }

  const inputBase = {
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
      onDismiss={reset}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {/* Title */}
        <Text
          style={{
            fontFamily: FONTS.heading,
            fontSize: 22,
            color: colors.textPrimary,
            marginBottom: 16,
            marginTop: 8,
          }}
        >
          Log Transaction
        </Text>

        {/* Segmented income/expense toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 4,
            marginBottom: 24,
          }}
        >
          {(['income', 'expense'] as TransactionType[]).map((t) => {
            const active = txType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setTxType(t)}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 11,
                  alignItems: 'center',
                  backgroundColor: active ? colors.gold : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.semibold,
                    fontSize: 14,
                    color: active ? (isDark ? colors.bg : '#FFF') : colors.textSecondary,
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Large amount input */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <BottomSheetInput
            style={{
              fontFamily: FONTS.display,
              fontSize: 48,
              color: colors.textPrimary,
              textAlign: 'center',
              includeFontPadding: false,
              minWidth: 120,
              letterSpacing: -1,
            }}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            value={amountText}
            onChangeText={(v) => setAmountText(formatInput(v))}
            keyboardType="numeric"
            returnKeyType="done"
          />
          <Text
            style={{
              fontFamily: FONTS.regular,
              fontSize: 12,
              color: colors.textMuted,
              marginTop: 2,
            }}
          >
            Amount ({currency})
          </Text>
        </View>

        {/* Category label */}
        <Text
          style={{
            fontFamily: FONTS.semibold,
            fontSize: 10,
            color: colors.textMuted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Category
        </Text>

        {/* Category scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          style={{ marginBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {cats.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = category === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 20,
                  backgroundColor: active ? meta.color + '22' : colors.surface,
                  borderWidth: 1.5,
                  borderColor: active ? meta.color : colors.border,
                }}
              >
                <Ionicons name={meta.icon as any} size={14} color={active ? meta.color : colors.textMuted} />
                <Text
                  style={{
                    fontFamily: FONTS.medium,
                    fontSize: 13,
                    color: active ? meta.color : colors.textSecondary,
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Note */}
        <Text
          style={{
            fontFamily: FONTS.semibold,
            fontSize: 10,
            color: colors.textMuted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Note
        </Text>
        <BottomSheetInput
          style={inputBase}
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.textMuted}
          value={note}
          onChangeText={setNote}
          returnKeyType="done"
          maxLength={120}
        />

        {/* Date picker */}
        <Text
          style={{
            fontFamily: FONTS.semibold,
            fontSize: 10,
            color: colors.textMuted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginTop: 16,
            marginBottom: 10,
          }}
        >
          Date
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: dateChoice === 'other' ? 10 : 24 }}>
          {(['today', 'yesterday', 'other'] as const).map((d) => {
            const active = dateChoice === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDateChoice(d)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 20,
                  backgroundColor: active ? colors.goldBg : colors.surface,
                  borderWidth: 1.5,
                  borderColor: active ? colors.gold : colors.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.medium,
                    fontSize: 13,
                    color: active ? colors.gold : colors.textSecondary,
                    textTransform: 'capitalize',
                  }}
                >
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {dateChoice === 'other' && (
          <BottomSheetInput
            style={{ ...inputBase, marginBottom: 24 }}
            placeholder="dd/mm/yyyy"
            placeholderTextColor={colors.textMuted}
            value={otherDate}
            onChangeText={setOtherDate}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            maxLength={10}
          />
        )}

        {/* Submit */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.gold,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: saving ? 0.7 : 1,
          }}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={isDark ? colors.bg : '#FFF'} size="small" />
          ) : (
            <Text
              style={{
                fontFamily: FONTS.semibold,
                fontSize: 16,
                color: isDark ? colors.bg : '#FFF',
              }}
            >
              Log Transaction
            </Text>
          )}
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface Props {
  onClose?: () => void;
}

export default function TransactionScreen({ onClose }: Props) {
  const { colors, isDark } = useTheme();
  const { user, household, currency } = useAuth();

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1-12
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [filter, setFilter] = useState<FilterType>('All');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const addSheetRef = useRef<BottomSheetModal>(null);

  // ── Navigate month ──────────────────────────────────────────────────────────
  function prevMonth() {
    setViewMonth((m) => {
      if (m === 1) { setViewYear((y) => y - 1); return 12; }
      return m - 1;
    });
  }
  function nextMonth() {
    setViewMonth((m) => {
      if (m === 12) { setViewYear((y) => y + 1); return 1; }
      return m + 1;
    });
  }

  // ── Load transactions ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Build date range for the month
    const startDate = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(viewYear, viewMonth, 0).getDate();
    const endDate = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let query = (supabase as any)
      .from('transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (household) {
      query = query.eq('household_id', household.id);
    } else {
      query = query.eq('user_id', user.id).is('household_id', null);
    }

    const { data, error } = await query;
    if (!error && data) {
      setTransactions(data as Transaction[]);
    }
    setLoading(false);
  }, [user, household, viewMonth, viewYear]);

  useEffect(() => { load(); }, [load]);

  // ── Delete ──────────────────────────────────────────────────────────────────
  function handleLongPress(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete transaction', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await (supabase as any).from('transactions').delete().eq('id', id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setTransactions((prev) => prev.filter((t) => t.id !== id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      },
    ]);
  }

  // ── Filtered + grouped ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === 'All') return transactions;
    return transactions.filter((t) =>
      filter === 'Income' ? t.type === 'income' : t.type === 'expense'
    );
  }, [transactions, filter]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  // ── Cash flow summary ───────────────────────────────────────────────────────
  const { totalIn, totalOut, net } = useMemo(() => {
    const totalIn = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const totalOut = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [transactions]);

  const s = makeStyles(colors, isDark);

  // ── Render list item ────────────────────────────────────────────────────────
  type ListItem =
    | { kind: 'summary' }
    | { kind: 'dateHeader'; label: string }
    | { kind: 'transaction'; item: Transaction; isLast: boolean };

  const listData = useMemo((): ListItem[] => {
    const result: ListItem[] = [];
    if (transactions.length > 0) {
      result.push({ kind: 'summary' });
    }
    for (const group of groups) {
      result.push({ kind: 'dateHeader', label: group.dateLabel });
      group.items.forEach((item, idx) => {
        result.push({ kind: 'transaction', item, isLast: idx === group.items.length - 1 });
      });
    }
    return result;
  }, [groups, transactions.length]);

  function renderItem({ item: listItem }: { item: ListItem }) {
    if (listItem.kind === 'summary') {
      return (
        <View style={s.summaryCard}>
          {/* Money In */}
          <View style={s.summaryCol}>
            <Text style={s.summaryLabel}>Money In</Text>
            <Text style={[s.summaryAmount, { color: colors.emerald }]}>
              {fmt(totalIn, currency as any)}
            </Text>
          </View>
          {/* Divider */}
          <View style={s.summaryDivider} />
          {/* Money Out */}
          <View style={s.summaryCol}>
            <Text style={s.summaryLabel}>Money Out</Text>
            <Text style={[s.summaryAmount, { color: colors.danger }]}>
              {fmt(totalOut, currency as any)}
            </Text>
          </View>
          {/* Divider */}
          <View style={s.summaryDivider} />
          {/* Net */}
          <View style={s.summaryCol}>
            <Text style={s.summaryLabel}>Net</Text>
            <Text
              style={[
                s.summaryAmount,
                { color: net >= 0 ? colors.gold : colors.danger },
              ]}
            >
              {net >= 0 ? '+' : '-'}{fmt(Math.abs(net), currency as any)}
            </Text>
          </View>
        </View>
      );
    }

    if (listItem.kind === 'dateHeader') {
      return (
        <View style={s.dateHeaderRow}>
          <Text style={s.dateHeaderText}>{listItem.label}</Text>
        </View>
      );
    }

    // transaction
    return (
      <View
        style={[
          s.txCard,
          listItem.isLast && { marginBottom: 8 },
        ]}
      >
        <TransactionRow
          item={listItem.item}
          colors={colors}
          isDark={isDark}
          currency={currency}
          onLongPress={handleLongPress}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ──────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Transactions</Text>
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{monthLabel(viewMonth, viewYear)}</Text>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Filter chips ────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
        style={s.filterScroll}
        keyboardShouldPersistTaps="handled"
      >
        {(['All', 'Income', 'Expense'] as FilterType[]).map((f) => {
          const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
              style={[s.filterChip, active && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List / loading / empty ───────────────────────────── */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : listData.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="wallet-outline" size={56} color={colors.textMuted} />
          <Text style={s.emptyTitle}>No transactions yet</Text>
          <Text style={s.emptySubtitle}>Tap + to log income or expenses</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, index) => {
            if (item.kind === 'summary') return 'summary';
            if (item.kind === 'dateHeader') return `header-${item.label}`;
            return item.item.id;
          }}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
        />
      )}

      {/* ── FAB ─────────────────────────────────────────────── */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          addSheetRef.current?.present();
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={isDark ? colors.bg : '#FFF'} />
      </TouchableOpacity>

      {/* ── Add Transaction Sheet ────────────────────────────── */}
      {user && (
        <AddTransactionSheet
          sheetRef={addSheetRef}
          colors={colors}
          isDark={isDark}
          currency={currency}
          userId={user.id}
          householdId={household?.id ?? null}
          onAdded={load}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 10,
      gap: 8,
    },
    headerTitle: {
      fontFamily: FONTS.heading,
      fontSize: 22,
      color: colors.textPrimary,
      marginRight: 'auto' as any,
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    navBtn: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    monthLabel: {
      fontFamily: FONTS.semibold,
      fontSize: 13,
      color: colors.textPrimary,
      minWidth: 100,
      textAlign: 'center',
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    },

    // Filter
    filterScroll: { maxHeight: 50 },
    filterRow: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      gap: 8,
      alignItems: 'center',
    },
    filterChip: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    filterChipText: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    filterChipTextActive: {
      color: isDark ? colors.bg : '#FFF',
      fontFamily: FONTS.semibold,
    },

    // Summary card
    summaryCard: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginTop: 12,
      marginBottom: 4,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.07,
      shadowRadius: 6,
      elevation: isDark ? 0 : 2,
    },
    summaryCol: { flex: 1, alignItems: 'center', gap: 4 },
    summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
    summaryLabel: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    summaryAmount: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
    },

    // Date header
    dateHeaderRow: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 6,
    },
    dateHeaderText: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },

    // Transaction card
    txCard: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      marginBottom: 2,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 3,
      elevation: isDark ? 0 : 1,
    },

    // List
    listContent: { paddingBottom: 100 },

    // Empty / loading
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 60,
    },
    emptyTitle: {
      fontFamily: FONTS.heading,
      fontSize: 20,
      color: colors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.textMuted,
    },

    // FAB
    fab: {
      position: 'absolute',
      bottom: 32,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.gold,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
  });
}
