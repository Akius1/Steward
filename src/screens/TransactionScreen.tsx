import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt, formatInput, parseInput } from '@/utils/currency';

// ─── Recurring template types ─────────────────────────────────────────────────
type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

interface RecurringTemplate {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note: string;
  frequency: RecurringFrequency;
  lastLoggedDate: string | null; // YYYY-MM-DD
  userId: string;
  householdId: string | null;
}

const RECURRING_KEY = 'steward_recurring_templates';

async function loadTemplates(): Promise<RecurringTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(RECURRING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveTemplates(templates: RecurringTemplate[]): Promise<void> {
  await AsyncStorage.setItem(RECURRING_KEY, JSON.stringify(templates));
}

function isDue(template: RecurringTemplate, today: string): boolean {
  if (!template.lastLoggedDate) return true; // never logged
  const last = new Date(template.lastLoggedDate);
  const now  = new Date(today);
  switch (template.frequency) {
    case 'daily':   return now > last;
    case 'weekly':  return (now.getTime() - last.getTime()) >= 7 * 24 * 60 * 60 * 1000;
    case 'monthly': return now.getFullYear() > last.getFullYear() || now.getMonth() > last.getMonth();
    default:        return false;
  }
}

// ─── CSV Parser for Nigerian bank statements ──────────────────────────────────
interface ParsedRow {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;
  type: 'income' | 'expense';
  suggestedCategory: string;
}

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['salary', 'payroll', 'wages', 'stipend'],                  category: 'Salary'        },
  { keywords: ['freelance', 'contract', 'invoice', 'consulting'],         category: 'Freelance'     },
  { keywords: ['transfer', 'trf', 'debit order', 'inflow'],               category: 'Transfer In'   },
  { keywords: ['rent', 'house', 'housing', 'landlord', 'apartment'],      category: 'Housing'       },
  { keywords: ['shoprite', 'market', 'grocery', 'food', 'chicken', 'eat',
               'kfc', 'mr biggs', 'domino', 'restaurant', 'meals'],       category: 'Food'          },
  { keywords: ['uber', 'bolt', 'transport', 'petrol', 'fuel', 'dangote',
               'bus', 'taxi', 'vehicle', 'car'],                          category: 'Transport'     },
  { keywords: ['dstv', 'gotv', 'netflix', 'cinema', 'ticket', 'spotify',
               'game', 'entertainment', 'airtime', 'data'],               category: 'Entertainment' },
  { keywords: ['electricity', 'nepa', 'phcn', 'ekedc', 'ibedc', 'water',
               'waste', 'utility', 'gas', 'lasg'],                        category: 'Utilities'     },
  { keywords: ['hospital', 'pharmacy', 'health', 'medic', 'clinic',
               'doctor', 'nhis', 'drug'],                                 category: 'Healthcare'    },
  { keywords: ['school', 'tuition', 'education', 'university', 'college',
               'course', 'training', 'exam'],                             category: 'Education'     },
  { keywords: ['savings', 'investment', 'mutual fund', 'stanbic', 'arm',
               'cowrywise', 'piggyvest'],                                 category: 'Savings'       },
  { keywords: ['shopping', 'jumia', 'konga', 'store', 'mall', 'amazon'],  category: 'Shopping'      },
];

function guessCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return 'Other';
}

function parseNigerianCSV(csvText: string): ParsedRow[] {
  const lines = csvText.trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Detect header row and column indices
  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''));
  const dateIdx  = header.findIndex((h) => h.includes('date'));
  const debitIdx = header.findIndex((h) => h.includes('debit') || h.includes('withdrawal') || h.includes('amount'));
  const creditIdx = header.findIndex((h) => h.includes('credit') || h.includes('deposit'));
  const descIdx  = header.findIndex((h) =>
    h.includes('description') || h.includes('narration') || h.includes('particulars') || h.includes('detail'));

  if (dateIdx < 0) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted commas
    const cols = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g)?.map((c) => c.trim().replace(/^"|"$/g, '')) ?? lines[i].split(',');

    const rawDate   = (cols[dateIdx] ?? '').trim();
    const rawDebit  = debitIdx >= 0 ? (cols[debitIdx] ?? '').replace(/[,₦\s]/g, '') : '';
    const rawCredit = creditIdx >= 0 ? (cols[creditIdx] ?? '').replace(/[,₦\s]/g, '') : '';
    const desc      = descIdx >= 0 ? (cols[descIdx] ?? '') : cols.join(' ');

    // Parse date (try DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
    let dateStr = '';
    const d1 = rawDate.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    const d2 = rawDate.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (d1) dateStr = `${d1[3]}-${d1[2]}-${d1[1]}`;
    else if (d2) dateStr = rawDate.replace(/\//g, '-');
    else continue; // skip unparseable date

    const debit  = parseFloat(rawDebit)  || 0;
    const credit = parseFloat(rawCredit) || 0;

    if (debit > 0) {
      rows.push({ date: dateStr, description: desc, amount: debit, type: 'expense', suggestedCategory: guessCategory(desc) });
    }
    if (credit > 0) {
      rows.push({ date: dateStr, description: desc, amount: credit, type: 'income', suggestedCategory: guessCategory(desc) });
    }
  }
  return rows;
}

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
  Utilities:     { icon: 'flash-outline',                color: '#06B6D4' },
  Other:         { icon: 'ellipsis-horizontal-outline', color: '#8FA3B5' },
};

const INCOME_CATS = ['Salary', 'Freelance', 'Business', 'Gift', 'Transfer In'];
const EXPENSE_CATS = ['Housing', 'Food', 'Transport', 'Utilities', 'Shopping', 'Healthcare', 'Education', 'Entertainment', 'Savings', 'Investment', 'Other'];

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

// ─── AddTransactionModal ──────────────────────────────────────────────────────
// Uses a plain React Native Modal instead of BottomSheetModal so it works
// correctly on iOS when the parent screen is itself a React Navigation modal
// (BottomSheetModal's Portal breaks inside RN modal view hierarchies on iOS).
function AddTransactionModal({
  visible,
  onClose,
  colors,
  isDark,
  currency,
  userId,
  householdId,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  isDark: boolean;
  currency: string;
  userId: string;
  householdId: string | null;
  onAdded: () => void;
}) {
  const insets = useSafeAreaInsets();

  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [dateChoice, setDateChoice] = useState<'today' | 'yesterday' | 'other'>('today');
  const [otherDate, setOtherDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');

  const cats = txType === 'income' ? INCOME_CATS : EXPENSE_CATS;

  useEffect(() => {
    if (category && !cats.includes(category)) setCategory('');
  }, [txType]);

  function getDateString(): string {
    const today = new Date();
    if (dateChoice === 'today') return today.toISOString().slice(0, 10);
    if (dateChoice === 'yesterday') {
      const yd = new Date(today);
      yd.setDate(today.getDate() - 1);
      return yd.toISOString().slice(0, 10);
    }
    const parts = otherDate.trim().split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(dateObj.getTime())) return dateObj.toISOString().slice(0, 10);
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
    setIsRecurring(false);
    setFrequency('monthly');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    const amount = parseInput(amountText);
    if (amount <= 0) { Alert.alert('Invalid amount', 'Enter an amount greater than 0.'); return; }
    if (!category)   { Alert.alert('Category required', 'Pick a category.'); return; }

    setSaving(true);
    const { error } = await (supabase as any).from('transactions').insert({
      user_id: userId,
      household_id: householdId,
      type: txType,
      amount,
      category,
      note: note.trim() || null,
      date: getDateString(),
    });
    setSaving(false);

    if (error) { Alert.alert('Failed to save', error.message); return; }

    // Save recurring template if enabled
    if (isRecurring) {
      const templates = await loadTemplates();
      const today = new Date().toISOString().slice(0, 10);
      const template: RecurringTemplate = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: txType,
        amount: parseInput(amountText),
        category,
        note: note.trim() || '',
        frequency,
        lastLoggedDate: today,
        userId,
        householdId,
      };
      await saveTemplates([...templates, template]);
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
    onClose();
    onAdded();
  }

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
  } as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop */}
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onPress={handleClose}
        />

        {/* Sheet */}
        <View style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          maxHeight: '92%',
          paddingBottom: insets.bottom + 8,
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, borderRadius: 2.5, backgroundColor: colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 }}
          >
            {/* Title */}
            <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 16, marginTop: 4 }}>
              Log Transaction
            </Text>

            {/* Income / Expense toggle */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, padding: 4, marginBottom: 24 }}>
              {(['income', 'expense'] as TransactionType[]).map((t) => {
                const active = txType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTxType(t)}
                    activeOpacity={0.85}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 11,
                      alignItems: 'center',
                      backgroundColor: active ? colors.gold : 'transparent',
                    }}
                  >
                    <Text style={{
                      fontFamily: FONTS.semibold, fontSize: 14,
                      color: active ? (isDark ? colors.bg : '#FFF') : colors.textSecondary,
                      textTransform: 'capitalize',
                    }}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Large amount input */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <TextInput
                style={{
                  fontFamily: FONTS.display, fontSize: 48,
                  color: colors.textPrimary, textAlign: 'center',
                  minWidth: 120, letterSpacing: -1,
                }}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={amountText}
                onChangeText={(v) => setAmountText(formatInput(v))}
                keyboardType="numeric"
                returnKeyType="done"
                cursorColor={colors.gold}
                selectionColor={colors.gold + '55'}
              />
              <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                Amount ({currency})
              </Text>
            </View>

            {/* Category */}
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Category
            </Text>
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
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
                      backgroundColor: active ? meta.color + '22' : colors.surface,
                      borderWidth: 1.5,
                      borderColor: active ? meta.color : colors.border,
                    }}
                  >
                    <Ionicons name={meta.icon as any} size={14} color={active ? meta.color : colors.textMuted} />
                    <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: active ? meta.color : colors.textSecondary }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Note */}
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Note
            </Text>
            <TextInput
              style={{ ...inputStyle, marginBottom: 0 }}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
              maxLength={120}
              cursorColor={colors.gold}
            />

            {/* Date */}
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 10 }}>
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
                      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
                      backgroundColor: active ? colors.goldBg : colors.surface,
                      borderWidth: 1.5,
                      borderColor: active ? colors.gold : colors.border,
                    }}
                  >
                    <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: active ? colors.gold : colors.textSecondary, textTransform: 'capitalize' }}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {dateChoice === 'other' && (
              <TextInput
                style={{ ...inputStyle, marginBottom: 24 }}
                placeholder="dd/mm/yyyy"
                placeholderTextColor={colors.textMuted}
                value={otherDate}
                onChangeText={setOtherDate}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                maxLength={10}
                cursorColor={colors.gold}
              />
            )}

            {/* Recurring */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.surface,
              borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
              borderWidth: 1.5, borderColor: isRecurring ? colors.gold : colors.border,
              marginBottom: isRecurring ? 10 : 24,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="repeat-outline" size={18} color={isRecurring ? colors.gold : colors.textMuted} />
                <View>
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary }}>
                    Recurring
                  </Text>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    Auto-log this transaction
                  </Text>
                </View>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: colors.border, true: colors.gold + 'AA' }}
                thumbColor={isRecurring ? colors.gold : colors.textMuted}
                ios_backgroundColor={colors.border}
              />
            </View>

            {isRecurring && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Frequency
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['daily', 'weekly', 'monthly'] as RecurringFrequency[]).map((f) => {
                    const active = frequency === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        onPress={() => setFrequency(f)}
                        activeOpacity={0.8}
                        style={{
                          flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center',
                          backgroundColor: active ? colors.goldBg : colors.surface,
                          borderWidth: 1.5, borderColor: active ? colors.gold : colors.border,
                        }}
                      >
                        <Text style={{
                          fontFamily: FONTS.medium, fontSize: 13,
                          color: active ? colors.gold : colors.textSecondary,
                          textTransform: 'capitalize',
                        }}>
                          {f}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={{ backgroundColor: colors.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', opacity: saving ? 0.7 : 1 }}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} size="small" />
                : <Text style={{ fontFamily: FONTS.semibold, fontSize: 16, color: isDark ? colors.bg : '#FFF' }}>Log Transaction</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── BankImportModal ──────────────────────────────────────────────────────────
interface ImportRow extends ParsedRow {
  rowId: string;
  editCategory: string;
  selected: boolean;
}

function BankImportModal({
  visible,
  onClose,
  colors,
  isDark,
  currency,
  userId,
  householdId,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  isDark: boolean;
  currency: string;
  userId: string;
  householdId: string | null;
  onImported: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<'idle' | 'parsing' | 'review' | 'importing'>('idle');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState('');

  const selectedCount = rows.filter((r) => r.selected).length;

  function resetModal() {
    setStage('idle');
    setRows([]);
    setError('');
  }

  function handleClose() {
    resetModal();
    onClose();
  }

  async function pickAndParse() {
    setError('');
    setStage('parsing');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        setStage('idle');
        return;
      }

      const asset = result.assets[0];
      const csvText = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });

      const parsed = parseNigerianCSV(csvText);
      if (parsed.length === 0) {
        setError("Couldn't read any transactions from this file. Make sure it's a CSV with date, amount, and description columns.");
        setStage('idle');
        return;
      }

      const importRows: ImportRow[] = parsed.map((p, i) => ({
        ...p,
        rowId: `${i}-${p.date}-${p.amount}`,
        editCategory: p.suggestedCategory,
        selected: true,
      }));

      setRows(importRows);
      setStage('review');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to read file.');
      setStage('idle');
    }
  }

  function toggleRow(rowId: string) {
    setRows((prev) => prev.map((r) => r.rowId === rowId ? { ...r, selected: !r.selected } : r));
  }

  function setCategory(rowId: string, cat: string) {
    setRows((prev) => prev.map((r) => r.rowId === rowId ? { ...r, editCategory: cat } : r));
  }

  function toggleAll() {
    const allSelected = rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  }

  async function importSelected() {
    const toImport = rows.filter((r) => r.selected);
    if (toImport.length === 0) return;
    setStage('importing');

    const inserts = toImport.map((r) => ({
      user_id: userId,
      household_id: householdId,
      type: r.type,
      amount: r.amount,
      category: r.editCategory,
      note: r.description.slice(0, 120) || null,
      date: r.date,
    }));

    // Insert in batches of 50
    const BATCH = 50;
    let failed = 0;
    for (let i = 0; i < inserts.length; i += BATCH) {
      const { error: err } = await (supabase as any).from('transactions').insert(inserts.slice(i, i + BATCH));
      if (err) failed++;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetModal();
    onClose();
    onImported();

    if (failed > 0) {
      Alert.alert('Partial import', `${toImport.length - failed * BATCH} transactions imported. Some batches failed.`);
    }
  }

  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: colors.textPrimary,
    flex: 1,
  } as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={handleClose}
        />

        <View style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          maxHeight: '90%',
          paddingBottom: insets.bottom + 8,
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, borderRadius: 2.5, backgroundColor: colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />

          {stage !== 'review' ? (
            /* ── Idle / parsing stage ── */
            <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }}>
              <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 8 }}>
                Import Bank Statement
              </Text>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 14, color: colors.textMuted, marginBottom: 24, lineHeight: 20 }}>
                Import your bank statement as a CSV file. Supports GTBank, Access, Zenith, First Bank and most Nigerian bank exports.
              </Text>

              {/* Supported banks info */}
              <View style={{
                backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 24,
                borderWidth: 1, borderColor: colors.border,
              }}>
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  How to export
                </Text>
                {[
                  { bank: 'GTBank', step: 'Internet banking → Statement → Download CSV' },
                  { bank: 'Access', step: 'AccessMore app → History → Export' },
                  { bank: 'Zenith', step: 'ZenithDirect → Account → Statement → CSV' },
                  { bank: 'First Bank', step: 'FirstMobile → Statements → Export CSV' },
                ].map(({ bank, step }) => (
                  <View key={bank} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold, width: 70 }}>{bank}</Text>
                    <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, flex: 1 }}>{step}</Text>
                  </View>
                ))}
              </View>

              {!!error && (
                <View style={{ backgroundColor: '#EF444422', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: '#EF4444' }}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: colors.gold, borderRadius: 14, paddingVertical: 16,
                  alignItems: 'center', opacity: stage === 'parsing' ? 0.7 : 1,
                  flexDirection: 'row', justifyContent: 'center', gap: 10,
                }}
                onPress={pickAndParse}
                disabled={stage === 'parsing'}
                activeOpacity={0.85}
              >
                {stage === 'parsing'
                  ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} size="small" />
                  : <>
                      <Ionicons name="cloud-upload-outline" size={20} color={isDark ? colors.bg : '#FFF'} />
                      <Text style={{ fontFamily: FONTS.semibold, fontSize: 16, color: isDark ? colors.bg : '#FFF' }}>
                        Choose CSV File
                      </Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Review stage ── */
            <>
              <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontFamily: FONTS.heading, fontSize: 20, color: colors.textPrimary, flex: 1 }}>
                    Review Transactions
                  </Text>
                  <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted }}>
                  {rows.length} transactions found · {selectedCount} selected
                </Text>

                {/* Select all */}
                <TouchableOpacity
                  onPress={toggleAll}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}
                >
                  <Ionicons
                    name={rows.every((r) => r.selected) ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={colors.gold}
                  />
                  <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: colors.gold }}>
                    {rows.every((r) => r.selected) ? 'Deselect all' : 'Select all'}
                  </Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={rows}
                keyExtractor={(r) => r.rowId}
                style={{ maxHeight: 380 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: row }) => {
                  const cats = row.type === 'income' ? INCOME_CATS : EXPENSE_CATS;
                  const meta = CATEGORY_META[row.editCategory] ?? CATEGORY_META['Other'];
                  return (
                    <TouchableOpacity
                      onPress={() => toggleRow(row.rowId)}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                        paddingVertical: 10, paddingHorizontal: 12,
                        backgroundColor: row.selected ? colors.surface : colors.bg,
                        borderRadius: 12, marginBottom: 6,
                        borderWidth: 1.5,
                        borderColor: row.selected ? meta.color + '66' : colors.border,
                        opacity: row.selected ? 1 : 0.5,
                      }}
                    >
                      {/* Checkbox */}
                      <Ionicons
                        name={row.selected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={row.selected ? meta.color : colors.textMuted}
                        style={{ marginTop: 1 }}
                      />

                      {/* Details */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text
                            style={{ fontFamily: FONTS.medium, fontSize: 12, color: colors.textMuted, flex: 1 }}
                            numberOfLines={1}
                          >
                            {row.date} · {row.description.slice(0, 40)}
                          </Text>
                          <Text style={{
                            fontFamily: FONTS.semibold, fontSize: 13,
                            color: row.type === 'income' ? colors.emerald : colors.danger,
                            marginLeft: 6,
                          }}>
                            {row.type === 'income' ? '+' : '-'}{fmt(row.amount, currency as any)}
                          </Text>
                        </View>

                        {/* Category picker chips (compact, horizontal scroll) */}
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 5, paddingTop: 6 }}
                          keyboardShouldPersistTaps="handled"
                          onStartShouldSetResponder={() => true}
                        >
                          {cats.map((cat) => {
                            const catMeta = CATEGORY_META[cat];
                            const active = row.editCategory === cat;
                            return (
                              <TouchableOpacity
                                key={cat}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  setCategory(row.rowId, cat);
                                }}
                                activeOpacity={0.7}
                                style={{
                                  flexDirection: 'row', alignItems: 'center', gap: 4,
                                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
                                  backgroundColor: active ? catMeta.color + '22' : colors.bg,
                                  borderWidth: 1, borderColor: active ? catMeta.color : colors.border,
                                }}
                              >
                                <Ionicons name={catMeta.icon as any} size={10} color={active ? catMeta.color : colors.textMuted} />
                                <Text style={{
                                  fontFamily: FONTS.medium, fontSize: 10,
                                  color: active ? catMeta.color : colors.textMuted,
                                }}>{cat}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Import button */}
              <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: selectedCount > 0 ? colors.gold : colors.border,
                    borderRadius: 14, paddingVertical: 16,
                    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10,
                    opacity: stage === 'importing' ? 0.7 : 1,
                  }}
                  onPress={importSelected}
                  disabled={selectedCount === 0 || stage === 'importing'}
                  activeOpacity={0.85}
                >
                  {stage === 'importing'
                    ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} size="small" />
                    : <>
                        <Ionicons name="checkmark-circle-outline" size={20} color={isDark ? colors.bg : '#FFF'} />
                        <Text style={{ fontFamily: FONTS.semibold, fontSize: 16, color: isDark ? colors.bg : '#FFF' }}>
                          Import {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''}
                        </Text>
                      </>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStage('idle')}
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', paddingVertical: 12 }}
                >
                  <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textMuted }}>
                    ← Choose a different file
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface Props {
  onClose?: () => void;
}

export default function TransactionScreen({ onClose }: Props) {
  const { colors, isDark } = useTheme();
  const { user, household, currency } = useAuth();
  const router = useRouter();

  // When opened as a route (transactions.tsx), onClose is undefined — fall back to router.back()
  const handleClose = onClose ?? (() => router.back());

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1-12
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [filter, setFilter] = useState<FilterType>('All');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const insets = useSafeAreaInsets();

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

  // ── Auto-log due recurring transactions on mount ────────────────────────────
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const templates = await loadTemplates();
      // Only process templates belonging to this user
      const mine = templates.filter(
        (t) => t.userId === user.id && t.householdId === (household?.id ?? null),
      );
      const due = mine.filter((t) => isDue(t, today));
      if (due.length === 0) return;

      let anyInserted = false;
      const updated = [...templates];

      for (const tmpl of due) {
        const { error } = await (supabase as any).from('transactions').insert({
          user_id: tmpl.userId,
          household_id: tmpl.householdId,
          type: tmpl.type,
          amount: tmpl.amount,
          category: tmpl.category,
          note: tmpl.note || null,
          date: today,
        });
        if (!error) {
          const idx = updated.findIndex((t) => t.id === tmpl.id);
          if (idx >= 0) updated[idx] = { ...updated[idx], lastLoggedDate: today };
          anyInserted = true;
        }
      }

      if (anyInserted) {
        await saveTemplates(updated);
        load(); // refresh list
      }
    })();
  // Run once on mount (user/household stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, household?.id]);

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
        {/* Close button — left side on Android feels more natural & always visible */}
        <TouchableOpacity
          onPress={handleClose}
          style={s.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={s.headerTitle}>Transactions</Text>

        {/* Import bank statement */}
        <TouchableOpacity
          onPress={() => setShowImportModal(true)}
          style={[s.closeBtn, { marginRight: 2 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-upload-outline" size={17} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{monthLabel(viewMonth, viewYear)}</Text>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
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
        style={[s.fab, { bottom: Math.max(insets.bottom, 16) + 16 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowAddModal(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={isDark ? colors.bg : '#FFF'} />
      </TouchableOpacity>

      {/* ── Add Transaction Modal ────────────────────────────── */}
      {user && (
        <AddTransactionModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          colors={colors}
          isDark={isDark}
          currency={currency}
          userId={user.id}
          householdId={household?.id ?? null}
          onAdded={load}
        />
      )}

      {/* ── Bank Import Modal ─────────────────────────────────── */}
      {user && (
        <BankImportModal
          visible={showImportModal}
          onClose={() => setShowImportModal(false)}
          colors={colors}
          isDark={isDark}
          currency={currency}
          userId={user.id}
          householdId={household?.id ?? null}
          onImported={load}
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
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      gap: 10,
    },
    headerTitle: {
      fontFamily: FONTS.heading,
      fontSize: 20,
      color: colors.textPrimary,
      flex: 1,
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    navBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    monthLabel: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.textPrimary,
      minWidth: 88,
      textAlign: 'center',
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
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

    // FAB — bottom is set dynamically using safe area insets
    fab: {
      position: 'absolute',
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
