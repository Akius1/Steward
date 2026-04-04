import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BUCKET_COLORS, FONTS } from '@/constants/theme';
import type { IncomeSource, IncomeType } from '@/types/database';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => '₦' + n.toLocaleString('en-NG');

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function getMonth() {
  return new Date().toLocaleString('en-NG', { month: 'long', year: 'numeric' });
}

const INCOME_TYPES: IncomeType[] = ['SALARY', 'FREELANCE', 'BUSINESS', 'GIFT', 'SIDE INCOME'];

const TYPE_META: Record<IncomeType, { icon: React.ComponentProps<typeof Ionicons>['name']; accentColor: string; accentBg: string }> = {
  SALARY:       { icon: 'briefcase-outline',    accentColor: '#10B97A', accentBg: 'rgba(16,185,122,0.12)' },
  FREELANCE:    { icon: 'laptop-outline',        accentColor: '#C9943F', accentBg: 'rgba(201,148,63,0.12)' },
  BUSINESS:     { icon: 'business-outline',      accentColor: '#60A5FA', accentBg: 'rgba(96,165,250,0.12)' },
  GIFT:         { icon: 'gift-outline',          accentColor: '#A78BFA', accentBg: 'rgba(167,139,250,0.12)' },
  'SIDE INCOME':{ icon: 'flash-outline',         accentColor: '#F59E0B', accentBg: 'rgba(245,158,11,0.12)' },
};

const TYPE_BADGE_BG: Record<IncomeType, { bg: string; text: string }> = {
  SALARY:       { bg: 'rgba(16,185,122,0.15)',  text: '#10B97A' },
  FREELANCE:    { bg: 'rgba(201,148,63,0.15)',   text: '#E8BE70' },
  BUSINESS:     { bg: 'rgba(96,165,250,0.15)',   text: '#60A5FA' },
  GIFT:         { bg: 'rgba(167,139,250,0.15)',  text: '#A78BFA' },
  'SIDE INCOME':{ bg: 'rgba(245,158,11,0.15)',   text: '#F59E0B' },
};

const SNAPSHOT_COLORS = BUCKET_COLORS;

// ─── Add Source Modal ─────────────────────────────────────────────────────────
interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: (src: IncomeSource) => void;
  colors: any;
  isDark: boolean;
  userId: string;
}

function AddSourceModal({ visible, onClose, onAdded, colors, isDark, userId }: AddModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<IncomeType>('SALARY');
  const [amountText, setAmountText] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(''); setType('SALARY'); setAmountText(''); setSubtitle('');
  }

  async function handleAdd() {
    const amount = parseInt(amountText.replace(/[^0-9]/g, ''));
    if (!name.trim() || !amount) {
      Alert.alert('Missing info', 'Please enter a name and valid amount.');
      return;
    }
    setSaving(true);
    // Get the live user ID from the active session — never rely on the prop
    // which may be stale or empty when RLS checks auth.uid() server-side.
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      setSaving(false);
      Alert.alert('Session expired', 'Please sign in again.');
      return;
    }
    const { data, error } = await (supabase as any)
      .from('income_sources')
      .insert({ user_id: currentUser.id, name: name.trim(), type, amount, subtitle: subtitle.trim() || null })
      .select()
      .single();
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    if (data) { onAdded(data); reset(); onClose(); }
  }

  const ms = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center', marginBottom: 20,
    },
    title: { fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 20 },
    label: {
      fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted,
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 12,
      fontFamily: FONTS.medium, fontSize: 15, color: colors.textPrimary,
      marginBottom: 18,
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    typePill: {
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1.5,
      borderColor: colors.border,
    },
    typePillText: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textSecondary },
    addBtn: {
      backgroundColor: colors.gold,
      borderRadius: 14, height: 52,
      alignItems: 'center', justifyContent: 'center', marginTop: 4,
    },
    addBtnText: { fontFamily: FONTS.semibold, fontSize: 15, color: isDark ? colors.bg : '#FFF' },
    cancelRow: { alignItems: 'center', marginTop: 12 },
    cancelText: { fontFamily: FONTS.medium, fontSize: 14, color: colors.textMuted },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable onPress={undefined}>
          <View style={ms.sheet}>
            <View style={ms.handle} />
            <Text style={ms.title}>Add Income Source</Text>

            <Text style={ms.label}>Source name</Text>
            <TextInput
              style={ms.input}
              placeholder="e.g., GTBank Salary"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={ms.label}>Type</Text>
            <View style={ms.typeRow}>
              {INCOME_TYPES.map((t) => {
                const selected = type === t;
                const badge = TYPE_BADGE_BG[t];
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      ms.typePill,
                      selected && { backgroundColor: badge.bg, borderColor: badge.text },
                    ]}
                    onPress={() => setType(t)}
                  >
                    <Text
                      style={[ms.typePillText, selected && { color: badge.text, fontFamily: FONTS.semibold }]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={ms.label}>Monthly amount (₦)</Text>
            <TextInput
              style={ms.input}
              placeholder="350,000"
              placeholderTextColor={colors.textMuted}
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="numeric"
            />

            <Text style={ms.label}>Description (optional)</Text>
            <TextInput
              style={ms.input}
              placeholder="Fixed monthly income"
              placeholderTextColor={colors.textMuted}
              value={subtitle}
              onChangeText={setSubtitle}
            />

            <TouchableOpacity style={ms.addBtn} onPress={handleAdd} disabled={saving}>
              {saving
                ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} />
                : <Text style={ms.addBtnText}>Add Source</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={ms.cancelRow} onPress={onClose}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function IncomeSetupScreen() {
  const { colors, isDark, toggleColorMode } = useTheme();
  const { user, profile, signOut } = useAuth();

  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [allocPct, setAllocPct] = useState(0);

  const totalIncome = sources.reduce((s, src) => s + src.amount, 0);
  const name = profile?.name ?? 'there';

  const loadSources = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('income_sources')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setSources(data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  const loadAllocPct = useCallback(async () => {
    if (!user || totalIncome === 0) return;
    const now = new Date();
    const { data } = await (supabase as any)
      .from('allocations')
      .select('amount')
      .eq('user_id', user.id)
      .eq('month', now.getMonth() + 1)
      .eq('year', now.getFullYear());
    if (data) {
      const allocated = (data as Array<{ amount: number }>).reduce((s, r) => s + r.amount, 0);
      setAllocPct(Math.round((allocated / totalIncome) * 100));
    }
  }, [user, totalIncome]);

  useEffect(() => { loadSources(); }, [loadSources]);
  useEffect(() => { loadAllocPct(); }, [loadAllocPct]);

  async function deleteSource(id: string) {
    Alert.alert('Remove Source', 'Remove this income source?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('income_sources').delete().eq('id', id);
          setSources((prev) => prev.filter((s) => s.id !== id));
        },
      },
    ]);
  }

  const isFullyAllocated = allocPct >= 99;

  const s = makeStyles(colors, isDark);

  if (loading) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <AddSourceModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={(src) => setSources((prev) => [src, ...prev])}
        colors={colors}
        isDark={isDark}
        userId={user!.id}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadSources(); loadAllocPct(); }}
            tintColor={colors.gold}
          />
        }
      >
        {/* ── App Header ─────────────────────────────────── */}
        <View style={s.appHeader}>
          <Text style={s.wordmark}>Steward</Text>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn} onPress={toggleColorMode}>
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={20}
                color={colors.gold}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.avatarBtn}
              onPress={() =>
                Alert.alert(profile?.name ?? 'Account', user?.email ?? '', [
                  { text: 'Sign Out', style: 'destructive', onPress: signOut },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            >
              <Text style={s.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Greeting ───────────────────────────────────── */}
        <View style={s.greetingBlock}>
          <Text style={s.greeting}>{getGreeting()},{'\n'}{name.split(' ')[0]}</Text>
          <Text style={s.subGreeting}>{getMonth()} · Income Overview</Text>
        </View>

        {/* ── Hero Income Card ───────────────────────────── */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>TOTAL MONTHLY INCOME</Text>
          {totalIncome > 0 ? (
            <Text style={s.heroAmount}>{fmt(totalIncome)}</Text>
          ) : (
            <Text style={[s.heroAmount, { color: colors.textMuted, fontSize: 28 }]}>
              Add income sources below
            </Text>
          )}

          {/* Stacked allocation bar */}
          {totalIncome > 0 && (
            <>
              <View style={s.stackedBar}>
                {SNAPSHOT_COLORS.map((color, i) => (
                  <View
                    key={i}
                    style={[
                      s.stackedSeg,
                      { flex: [29, 10, 22, 10, 5, 15, 9][i], backgroundColor: color },
                      i > 0 && { marginLeft: 2 },
                    ]}
                  />
                ))}
              </View>

              {/* Stats row */}
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={s.statValue}>{sources.length}</Text>
                  <Text style={s.statLabel}>Sources</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: isFullyAllocated ? colors.success : colors.warning }]}>
                    {allocPct}%
                  </Text>
                  <Text style={s.statLabel}>Allocated</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statValue, {
                    color: isFullyAllocated ? colors.success : colors.textPrimary,
                  }]}>
                    {isFullyAllocated ? '₦0' : fmt(Math.round(totalIncome * (1 - allocPct / 100)))}
                  </Text>
                  <Text style={s.statLabel}>Remaining</Text>
                </View>
              </View>

              {isFullyAllocated && (
                <View style={s.allocBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={s.allocBadgeText}>
                    100% allocated · Every naira has a purpose
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── Income Sources ─────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Income Sources</Text>
            <Text style={s.sectionCount}>{sources.length} source{sources.length !== 1 ? 's' : ''}</Text>
          </View>

          {sources.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="wallet-outline" size={40} color={colors.textMuted} />
              <Text style={s.emptyTitle}>No income sources yet</Text>
              <Text style={s.emptySubtitle}>
                Add your salary, freelance income, or any other income source to get started.
              </Text>
            </View>
          ) : (
            sources.map((src, i) => {
              const meta = TYPE_META[src.type] ?? TYPE_META.SALARY;
              const badge = TYPE_BADGE_BG[src.type] ?? TYPE_BADGE_BG.SALARY;
              return (
                <TouchableOpacity
                  key={src.id}
                  style={[s.sourceCard, i > 0 && s.mt10]}
                  activeOpacity={0.75}
                  onLongPress={() => deleteSource(src.id)}
                >
                  <View style={[s.sourceIconWrap, { backgroundColor: meta.accentBg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.accentColor} />
                  </View>
                  <View style={s.sourceInfo}>
                    <View style={s.sourceNameRow}>
                      <Text style={s.sourceName}>{src.name}</Text>
                      <View style={[s.typeBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[s.typeBadgeText, { color: badge.text }]}>{src.type}</Text>
                      </View>
                    </View>
                    <Text style={s.sourceSubtitle}>{src.subtitle ?? 'Income source'}</Text>
                  </View>
                  <View style={s.sourceRight}>
                    <Text style={s.sourceAmount}>{fmt(src.amount)}</Text>
                    <Text style={s.sourceFreq}>/ month</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity style={s.addSourceBtn} onPress={() => setShowAdd(true)} activeOpacity={0.75}>
            <Ionicons name="add-circle-outline" size={18} color={colors.gold} />
            <Text style={s.addSourceText}>Add Income Source</Text>
          </TouchableOpacity>

          {sources.length > 0 && (
            <Text style={s.longPressHint}>Long-press a card to remove it</Text>
          )}
        </View>

        {/* ── Sign Out (subtle) ──────────────────────────── */}
        <TouchableOpacity style={s.signOutRow} onPress={signOut}>
          <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingBottom: 40 },

    appHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2,
    },
    wordmark: { fontFamily: FONTS.heading, fontSize: 22, color: colors.gold, letterSpacing: 0.4 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.goldBg, alignItems: 'center', justifyContent: 'center',
    },
    avatarBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.goldBg, borderWidth: 1.5, borderColor: colors.goldDim,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarLetter: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.gold },

    greetingBlock: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22 },
    greeting: { fontFamily: FONTS.heading, fontSize: 28, color: colors.textPrimary, marginBottom: 4 },
    subGreeting: { fontFamily: FONTS.regular, fontSize: 14, color: colors.textSecondary },

    heroCard: {
      marginHorizontal: 20, marginBottom: 28,
      backgroundColor: colors.card, borderRadius: 18,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 8, elevation: isDark ? 0 : 3,
    },
    heroLabel: {
      fontFamily: FONTS.semibold, fontSize: 11, color: colors.textMuted,
      letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
    },
    heroAmount: {
      fontFamily: FONTS.display, fontSize: 44, color: colors.gold,
      letterSpacing: -1.5, marginBottom: 18,
    },

    stackedBar: { flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 16 },
    stackedSeg: { height: 10, borderRadius: 2 },

    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginBottom: 10,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary, marginBottom: 3 },
    statLabel: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted },
    statDivider: { width: 1, height: 30, backgroundColor: colors.border },

    allocBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.successBg, borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 8,
    },
    allocBadgeText: { fontFamily: FONTS.medium, fontSize: 12, color: colors.success },

    section: { paddingHorizontal: 20, marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary },
    sectionCount: { fontFamily: FONTS.medium, fontSize: 13, color: colors.textMuted },
    mt10: { marginTop: 10 },

    emptyCard: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border,
      padding: 28, alignItems: 'center', marginBottom: 12,
    },
    emptyTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary, marginTop: 12, marginBottom: 6 },
    emptySubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

    sourceCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border,
      padding: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 2,
    },
    sourceIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    sourceInfo: { flex: 1 },
    sourceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    sourceName: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary },
    sourceSubtitle: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },
    sourceRight: { alignItems: 'flex-end' },
    sourceAmount: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.textPrimary, marginBottom: 3 },
    sourceFreq: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted },

    typeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    typeBadgeText: { fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.4 },

    addSourceBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginTop: 10, paddingVertical: 15, borderRadius: 14,
      borderWidth: 1.5, borderColor: colors.goldDim, borderStyle: 'dashed',
      backgroundColor: colors.goldBg,
    },
    addSourceText: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.gold },

    longPressHint: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 8 },

    signOutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
    signOutText: { fontFamily: FONTS.medium, fontSize: 13, color: colors.textMuted },
  });
}
