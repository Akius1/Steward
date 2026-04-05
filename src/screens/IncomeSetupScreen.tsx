import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, Alert, RefreshControl,
  Pressable, Animated, Share, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BUCKET_COLORS, FONTS } from '@/constants/theme';
import { fmt, formatInput, parseInput, CURRENCIES, CURRENCY_LIST, type CurrencyCode } from '@/utils/currency';
import type { IncomeSource, IncomeType } from '@/types/database';

// ─── Constants ────────────────────────────────────────────────────────────────
const INCOME_TYPES: IncomeType[] = ['SALARY', 'FREELANCE', 'BUSINESS', 'GIFT', 'SIDE INCOME'];

const TYPE_META: Record<IncomeType, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }> = {
  SALARY:        { icon: 'briefcase-outline',  color: '#10B97A', bg: 'rgba(16,185,122,0.12)' },
  FREELANCE:     { icon: 'laptop-outline',     color: '#C9943F', bg: 'rgba(201,148,63,0.12)' },
  BUSINESS:      { icon: 'business-outline',   color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  GIFT:          { icon: 'gift-outline',       color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  'SIDE INCOME': { icon: 'flash-outline',      color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
};

const TYPE_BADGE: Record<IncomeType, { bg: string; text: string }> = {
  SALARY:        { bg: 'rgba(16,185,122,0.15)',  text: '#10B97A' },
  FREELANCE:     { bg: 'rgba(201,148,63,0.15)',  text: '#E8BE70' },
  BUSINESS:      { bg: 'rgba(96,165,250,0.15)',  text: '#60A5FA' },
  GIFT:          { bg: 'rgba(167,139,250,0.15)', text: '#A78BFA' },
  'SIDE INCOME': { bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B' },
};

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function getMonth() {
  return new Date().toLocaleString('en-NG', { month: 'long', year: 'numeric' });
}

// ─── Add Source Modal ─────────────────────────────────────────────────────────
function AddSourceModal({ visible, onClose, onAdded, colors, isDark, currency, householdId }: {
  visible: boolean; onClose: () => void; onAdded: (src: IncomeSource) => void;
  colors: any; isDark: boolean; currency: CurrencyCode; householdId: string | null;
}) {
  const [name, setName]             = useState('');
  const [type, setType]             = useState<IncomeType>('SALARY');
  const [amountText, setAmountText] = useState('');
  const [subtitle, setSubtitle]     = useState('');
  const [saving, setSaving]         = useState(false);

  const sheetRef   = useRef<BottomSheetModal>(null);
  const amountRef  = useRef<any>(null);
  const subtitleRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  function reset() { setName(''); setType('SALARY'); setAmountText(''); setSubtitle(''); }

  function handleAmountChange(raw: string) {
    setAmountText(formatInput(raw));
  }

  async function handleAdd() {
    const amount = parseInput(amountText);
    if (!name.trim() || !amount) {
      Alert.alert('Missing info', 'Please enter a source name and amount.');
      return;
    }
    setSaving(true);
    const { data: { user: cu } } = await supabase.auth.getUser();
    if (!cu) { setSaving(false); Alert.alert('Session expired', 'Please sign in again.'); return; }
    const { data, error } = await (supabase as any)
      .from('income_sources')
      .insert({
        user_id: cu.id,
        household_id: householdId,
        name: name.trim(), type, amount,
        subtitle: subtitle.trim() || null,
      })
      .select().single();
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    if (data) { onAdded(data); reset(); onClose(); }
  }

  const sym = CURRENCIES[currency].symbol;
  const ms = makeModalStyles(colors, isDark);

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
    />
  );

  const inputStyle: any = {
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
    marginBottom: 18,
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableDynamicSizing={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        <Text style={ms.title}>Add Income Source</Text>

        {/* Source name */}
        <Text style={ms.label}>SOURCE NAME</Text>
        <BottomSheetTextInput
          style={inputStyle}
          placeholder="e.g. GTBank Salary"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          onSubmitEditing={() => amountRef.current?.focus()}
          blurOnSubmit={false}
          autoCorrect={false}
        />

        {/* Type pills */}
        <Text style={ms.label}>TYPE</Text>
        <View style={ms.typeRow}>
          {INCOME_TYPES.map((t) => {
            const sel = type === t;
            const b = TYPE_BADGE[t];
            return (
              <TouchableOpacity key={t}
                style={[ms.typePill, sel && { backgroundColor: b.bg, borderColor: b.text }]}
                onPress={() => setType(t)}>
                <Text style={[ms.typePillTxt, sel && { color: b.text, fontFamily: FONTS.semibold }]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Amount — big Revolut-style input */}
        <Text style={ms.label}>AMOUNT</Text>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 2,
          borderBottomColor: colors.gold + '44',
          paddingBottom: 16,
          marginBottom: 24,
        }}>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 36, color: colors.gold, marginRight: 8 }}>{sym}</Text>
          <BottomSheetTextInput
            ref={amountRef}
            style={{
              flex: 1,
              fontSize: 40,
              fontFamily: FONTS.heading,
              color: colors.gold,
              textAlign: 'right',
              includeFontPadding: false,
            }}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            value={amountText}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
            returnKeyType="next"
            onSubmitEditing={() => subtitleRef.current?.focus()}
            blurOnSubmit={false}
            selectTextOnFocus
            cursorColor={colors.gold}
            selectionColor={colors.gold + '55'}
          />
        </View>

        {/* Description */}
        <Text style={ms.label}>DESCRIPTION (OPTIONAL)</Text>
        <BottomSheetTextInput
          ref={subtitleRef}
          style={inputStyle}
          placeholder="e.g. Fixed monthly income"
          placeholderTextColor={colors.textMuted}
          value={subtitle}
          onChangeText={setSubtitle}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />

        <TouchableOpacity style={ms.addBtn} onPress={handleAdd} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} />
            : <Text style={ms.addBtnTxt}>Add Source</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={ms.cancelRow} onPress={onClose}>
          <Text style={ms.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Currency Picker Modal ────────────────────────────────────────────────────
function CurrencyModal({ visible, current, onSelect, onClose, colors, isDark }: {
  visible: boolean; current: CurrencyCode; onSelect: (c: CurrencyCode) => void;
  onClose: () => void; colors: any; isDark: boolean;
}) {
  const ms = makeModalStyles(colors, isDark);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable onPress={undefined}>
          <View style={ms.sheet}>
            <View style={ms.handle} />
            <Text style={ms.title}>Select Currency</Text>
            <Text style={[ms.label, { marginBottom: 16 }]}>Choose your preferred currency for all amounts</Text>
            {CURRENCY_LIST.map((c) => {
              const sel = c.code === current;
              return (
                <TouchableOpacity key={c.code}
                  style={[ms.currencyRow, sel && { backgroundColor: colors.goldBg, borderColor: colors.gold }]}
                  onPress={() => { onSelect(c.code as CurrencyCode); onClose(); }}
                  activeOpacity={0.75}>
                  <Text style={ms.currencyFlag}>{c.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[ms.currencyName, sel && { color: colors.gold }]}>{c.name}</Text>
                    <Text style={ms.currencyCode}>{c.code} · {c.symbol}</Text>
                  </View>
                  {sel && <Ionicons name="checkmark-circle" size={20} color={colors.gold} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Household Modal ──────────────────────────────────────────────────────────
function HouseholdModal({ visible, onClose, colors, isDark, household, members, userId, onRefresh }: {
  visible: boolean; onClose: () => void; colors: any; isDark: boolean;
  household: any; members: any[]; userId: string; onRefresh: () => void;
}) {
  const [tab, setTab] = useState<'view' | 'create' | 'join'>(!household ? 'create' : 'view');
  const [hhName, setHhName] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [saving, setSaving] = useState(false);

  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      setTab(household ? 'view' : 'create');
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, household]);

  async function createHousehold() {
    if (!hhName.trim()) { Alert.alert('Name required', 'Give your household a name.'); return; }
    setSaving(true);
    const { data: { user: cu } } = await supabase.auth.getUser();
    if (!cu) { setSaving(false); return; }

    // Generate invite code
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data: hh, error } = await (supabase as any)
      .from('households')
      .insert({ name: hhName.trim(), owner_id: cu.id, invite_code: code, currency: 'NGN' })
      .select().single();
    if (error) { setSaving(false); Alert.alert('Error', error.message); return; }

    // Add creator as owner member
    await (supabase as any).from('household_members').insert({
      household_id: hh.id, user_id: cu.id, role: 'owner',
    });
    setSaving(false);
    onRefresh();
    setTab('view');
  }

  async function joinHousehold() {
    const code = inviteInput.trim().toUpperCase();
    if (code.length < 6) { Alert.alert('Invalid code', 'Enter a valid 6-character invite code.'); return; }
    setSaving(true);
    const { data: { user: cu } } = await supabase.auth.getUser();
    if (!cu) { setSaving(false); return; }

    // Use RPC so the lookup bypasses RLS (joining user isn't a member yet)
    // RPC returns an array even with limit 1, so grab the first element
    const { data: hhRows, error: findErr } = await (supabase as any)
      .rpc('find_household_by_invite', { code });
    const hh = Array.isArray(hhRows) ? hhRows[0] : hhRows;
    if (findErr || !hh?.id) { setSaving(false); Alert.alert('Not found', 'No household found with that code.'); return; }

    const { error: joinErr } = await (supabase as any)
      .from('household_members').insert({ household_id: hh.id, user_id: cu.id, role: 'member' });
    setSaving(false);
    if (joinErr) { Alert.alert('Error', joinErr.message); return; }
    onRefresh();
    setTab('view');
  }

  async function leaveHousehold() {
    Alert.alert('Leave Household', 'Are you sure you want to leave this shared budget?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        const { data: { user: cu } } = await supabase.auth.getUser();
        if (!cu || !household) return;
        await (supabase as any).from('household_members')
          .delete().eq('household_id', household.id).eq('user_id', cu.id);
        onRefresh();
        onClose();
      }},
    ]);
  }

  function copyCode() {
    if (household?.invite_code) {
      Clipboard.setString(household.invite_code);
      Alert.alert('Copied!', `Invite code ${household.invite_code} copied to clipboard.`);
    }
  }

  function shareCode() {
    if (household?.invite_code) {
      Share.share({
        message: `Join my Steward household "${household.name}"!\nUse invite code: ${household.invite_code}\n\nDownload Steward to get started.`,
        title: 'Join my Steward household',
      });
    }
  }

  const ms = makeModalStyles(colors, isDark);

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
    />
  );

  const inputStyle: any = {
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
    marginBottom: 18,
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableDynamicSizing={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        {/* Tab bar when no household */}
        {!household && (
          <View style={ms.tabRow}>
            {(['create', 'join'] as const).map((t) => (
              <TouchableOpacity key={t} style={[ms.tab, tab === t && ms.tabActive]} onPress={() => setTab(t)}>
                <Text style={[ms.tabTxt, tab === t && { color: colors.gold }]}>
                  {t === 'create' ? 'Create' : 'Join'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── VIEW HOUSEHOLD ── */}
        {tab === 'view' && household && (
          <View>
            <View style={ms.hhHeader}>
              <View style={ms.hhIcon}>
                <Ionicons name="people" size={28} color={colors.gold} />
              </View>
              <Text style={ms.hhName}>{household.name}</Text>
              <Text style={[ms.label, { textAlign: 'center', marginBottom: 0 }]}>
                {members.length} member{members.length !== 1 ? 's' : ''} · Shared budget
              </Text>
            </View>

            {/* Invite code */}
            <View style={ms.codeCard}>
              <Text style={ms.codeLabel}>INVITE CODE</Text>
              <Text style={ms.codeValue}>{household.invite_code}</Text>
              <Text style={ms.codeHint}>Share this code so others can join your household</Text>
              <View style={ms.codeActions}>
                <TouchableOpacity style={ms.codeBtn} onPress={copyCode}>
                  <Ionicons name="copy-outline" size={16} color={colors.gold} />
                  <Text style={ms.codeBtnTxt}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ms.codeBtn, { backgroundColor: colors.goldBg }]} onPress={shareCode}>
                  <Ionicons name="share-social-outline" size={16} color={colors.gold} />
                  <Text style={ms.codeBtnTxt}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Members */}
            <Text style={[ms.label, { marginBottom: 12 }]}>MEMBERS</Text>
            {members.map((m: any) => (
              <View key={m.user_id} style={ms.memberRow}>
                <View style={ms.memberAvatar}>
                  <Text style={ms.memberAvatarTxt}>
                    {(m.name ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ms.memberName}>{m.name ?? 'Member'}</Text>
                  <Text style={ms.memberRole}>{m.role}</Text>
                </View>
                {m.user_id === household.owner_id && (
                  <View style={ms.ownerBadge}>
                    <Text style={ms.ownerBadgeTxt}>Owner</Text>
                  </View>
                )}
              </View>
            ))}

            {/* Leave */}
            {household.owner_id !== userId && (
              <TouchableOpacity style={ms.leaveBtn} onPress={leaveHousehold}>
                <Ionicons name="exit-outline" size={16} color={colors.danger} />
                <Text style={[ms.cancelTxt, { color: colors.danger }]}>Leave Household</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── CREATE HOUSEHOLD ── */}
        {tab === 'create' && (
          <View>
            <Text style={ms.title}>Create Household</Text>
            <Text style={[ms.label, { marginBottom: 16, textTransform: 'none', fontSize: 13, letterSpacing: 0 }]}>
              Create a shared budget space for you and your partner or family.
            </Text>
            <Text style={ms.label}>HOUSEHOLD NAME</Text>
            <BottomSheetTextInput
              style={inputStyle}
              placeholder="e.g. The Stewards"
              placeholderTextColor={colors.textMuted}
              value={hhName}
              onChangeText={setHhName}
              returnKeyType="done"
              onSubmitEditing={createHousehold}
            />
            <TouchableOpacity style={ms.addBtn} onPress={createHousehold} disabled={saving}>
              {saving ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} />
                : <Text style={ms.addBtnTxt}>Create Household</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={ms.cancelRow} onPress={onClose}>
              <Text style={ms.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── JOIN HOUSEHOLD ── */}
        {tab === 'join' && (
          <View>
            <Text style={ms.title}>Join Household</Text>
            <Text style={[ms.label, { marginBottom: 16, textTransform: 'none', fontSize: 13, letterSpacing: 0 }]}>
              Enter the 6-character invite code from your partner or family member.
            </Text>
            <Text style={ms.label}>INVITE CODE</Text>
            <BottomSheetTextInput
              style={[inputStyle, { letterSpacing: 4, fontSize: 20, textAlign: 'center', fontFamily: FONTS.heading }]}
              placeholder="XXXXXX"
              placeholderTextColor={colors.textMuted}
              value={inviteInput}
              onChangeText={(t) => setInviteInput(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={joinHousehold}
              autoCorrect={false}
            />
            <TouchableOpacity style={ms.addBtn} onPress={joinHousehold} disabled={saving}>
              {saving ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} />
                : <Text style={ms.addBtnTxt}>Join Household</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={ms.cancelRow} onPress={onClose}>
              <Text style={ms.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function IncomeSetupScreen() {
  const { colors, isDark, toggleColorMode } = useTheme();
  const { user, profile, household, householdMembers, currency, signOut, setCurrency, refreshHousehold } = useAuth();

  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allocPct, setAllocPct]   = useState(0);
  const [showAdd, setShowAdd]     = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [showHousehold, setShowHousehold] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;

  const firstName = profile?.name?.split(' ')[0] ?? 'there';
  const totalIncome = sources.reduce((s, src) => s + src.amount, 0);
  const isFullyAllocated = allocPct >= 99;

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadSources = useCallback(async () => {
    if (!user) return;
    let query = (supabase as any).from('income_sources').select('*').order('created_at', { ascending: false });
    if (household) {
      // Show all household members' sources combined
      query = query.eq('household_id', household.id);
    } else {
      query = query.eq('user_id', user.id).is('household_id', null);
    }
    const { data } = await query;
    if (data) setSources(data);
    setLoading(false);
    setRefreshing(false);
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [user, household]);

  const loadAllocPct = useCallback(async () => {
    if (!user || totalIncome === 0) return;
    const now = new Date();
    let query = (supabase as any).from('allocations').select('amount')
      .eq('month', now.getMonth() + 1).eq('year', now.getFullYear());
    query = household ? query.eq('household_id', household.id) : query.eq('user_id', user.id).is('household_id', null);
    const { data } = await query;
    if (data) {
      const allocated = (data as any[]).reduce((s: number, r: any) => s + r.amount, 0);
      setAllocPct(Math.round((allocated / totalIncome) * 100));
    }
  }, [user, household, totalIncome]);

  useEffect(() => { loadSources(); }, [loadSources]);
  useEffect(() => { loadAllocPct(); }, [loadAllocPct]);

  async function deleteSource(id: string, ownerUserId: string) {
    if (household && ownerUserId !== user?.id) {
      Alert.alert('Cannot remove', "You can only remove income sources you added.");
      return;
    }
    Alert.alert('Remove Source', 'Remove this income source?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await (supabase as any).from('income_sources').delete().eq('id', id);
        setSources((prev) => prev.filter((s) => s.id !== id));
      }},
    ]);
  }

  function handleRefresh() {
    setRefreshing(true);
    Promise.all([loadSources(), loadAllocPct(), refreshHousehold()]);
  }

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

      <AddSourceModal visible={showAdd} onClose={() => setShowAdd(false)}
        onAdded={(src) => setSources((prev) => [src, ...prev])}
        colors={colors} isDark={isDark} currency={currency}
        householdId={household?.id ?? null} />

      <CurrencyModal visible={showCurrency} current={currency}
        onSelect={setCurrency} onClose={() => setShowCurrency(false)}
        colors={colors} isDark={isDark} />

      <HouseholdModal visible={showHousehold} onClose={() => setShowHousehold(false)}
        colors={colors} isDark={isDark} household={household}
        members={householdMembers} userId={user?.id ?? ''}
        onRefresh={refreshHousehold} />

      <Animated.ScrollView
        style={{ opacity: fadeIn }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
        }
      >
        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.appHeader}>
          <Text style={s.wordmark}>Steward</Text>
          <View style={s.headerActions}>
            {/* Currency picker */}
            <TouchableOpacity style={s.currencyChip} onPress={() => setShowCurrency(true)}>
              <Text style={s.currencyChipFlag}>{CURRENCIES[currency].flag}</Text>
              <Text style={s.currencyChipCode}>{currency}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.gold} />
            </TouchableOpacity>
            {/* Theme toggle */}
            <TouchableOpacity style={s.iconBtn} onPress={toggleColorMode}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.gold} />
            </TouchableOpacity>
            {/* Avatar / account */}
            <TouchableOpacity style={s.avatarBtn}
              onPress={() => Alert.alert(profile?.name ?? 'Account', user?.email ?? '', [
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
                { text: 'Cancel', style: 'cancel' },
              ])}>
              <Text style={s.avatarLetter}>{(profile?.name ?? 'U').charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Greeting ───────────────────────────────────── */}
        <View style={s.greetingBlock}>
          <Text style={s.greeting}>{getGreeting()},{'\n'}{firstName}</Text>
          <Text style={s.subGreeting}>{getMonth()} · Income Overview</Text>
        </View>

        {/* ── Household Banner ────────────────────────────── */}
        <TouchableOpacity style={s.householdBanner} onPress={() => setShowHousehold(true)} activeOpacity={0.8}>
          <View style={[s.hhIconSmall, household && { backgroundColor: colors.goldBg }]}>
            <Ionicons name={household ? 'people' : 'people-outline'} size={16}
              color={household ? colors.gold : colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            {household ? (
              <>
                <Text style={s.hhBannerTitle}>{household.name}</Text>
                <Text style={s.hhBannerSub}>{householdMembers.length} member{householdMembers.length !== 1 ? 's' : ''} · Tap to manage</Text>
              </>
            ) : (
              <>
                <Text style={s.hhBannerTitle}>Budget together</Text>
                <Text style={s.hhBannerSub}>Create or join a household to share income & allocations</Text>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* ── Hero Card ───────────────────────────────────── */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>TOTAL MONTHLY INCOME</Text>
          {totalIncome > 0 ? (
            <Text style={s.heroAmount}>{fmt(totalIncome, currency)}</Text>
          ) : (
            <Text style={[s.heroAmount, { color: colors.textMuted, fontSize: 26 }]}>
              Add income sources below
            </Text>
          )}

          {totalIncome > 0 && (
            <>
              {/* Stacked colour bar */}
              <View style={s.stackedBar}>
                {BUCKET_COLORS.map((c, i) => (
                  <View key={i} style={[
                    s.stackedSeg,
                    { flex: [29, 10, 22, 10, 5, 15, 9][i], backgroundColor: c },
                    i > 0 && { marginLeft: 2 },
                  ]} />
                ))}
              </View>

              {/* Stats row */}
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={s.statVal}>{sources.length}</Text>
                  <Text style={s.statLbl}>Sources</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: isFullyAllocated ? colors.success : colors.warning }]}>
                    {allocPct}%
                  </Text>
                  <Text style={s.statLbl}>Allocated</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: isFullyAllocated ? colors.success : colors.textPrimary }]}>
                    {isFullyAllocated ? fmt(0, currency) : fmt(Math.round(totalIncome * (1 - allocPct / 100)), currency)}
                  </Text>
                  <Text style={s.statLbl}>Remaining</Text>
                </View>
              </View>

              {isFullyAllocated && (
                <View style={s.allocBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={s.allocBadgeTxt}>
                    100% allocated · Every {CURRENCIES[currency].name.split(' ')[0]} has a purpose
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
              <Ionicons name="wallet-outline" size={44} color={colors.textMuted} />
              <Text style={s.emptyTitle}>No income sources yet</Text>
              <Text style={s.emptySubtitle}>Add your salary, freelance work, or any income to get started.</Text>
            </View>
          ) : (
            sources.map((src, i) => {
              const meta = TYPE_META[src.type] ?? TYPE_META.SALARY;
              const badge = TYPE_BADGE[src.type] ?? TYPE_BADGE.SALARY;
              const isOwn = src.user_id === user?.id;
              return (
                <TouchableOpacity key={src.id}
                  style={[s.sourceCard, i > 0 && { marginTop: 10 }]}
                  activeOpacity={0.75}
                  onLongPress={() => deleteSource(src.id, src.user_id)}>
                  <View style={[s.srcIconWrap, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={s.srcInfo}>
                    <View style={s.srcNameRow}>
                      <Text style={s.srcName}>{src.name}</Text>
                      <View style={[s.typeBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[s.typeBadgeTxt, { color: badge.text }]}>{src.type}</Text>
                      </View>
                    </View>
                    <Text style={s.srcSub}>
                      {src.subtitle ?? 'Income source'}
                      {household && !isOwn ? ' · Partner' : ''}
                    </Text>
                  </View>
                  <View style={s.srcRight}>
                    <Text style={s.srcAmount}>{fmt(src.amount, currency)}</Text>
                    <Text style={s.srcFreq}>/ month</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity style={s.addSourceBtn} onPress={() => setShowAdd(true)} activeOpacity={0.75}>
            <Ionicons name="add-circle-outline" size={18} color={colors.gold} />
            <Text style={s.addSourceTxt}>Add Income Source</Text>
          </TouchableOpacity>
          {sources.length > 0 && <Text style={s.longPressHint}>Long-press a card to remove it</Text>}
        </View>

        {/* ── Sign Out ────────────────────────────────────── */}
        <TouchableOpacity style={s.signOutRow} onPress={signOut}>
          <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
          <Text style={s.signOutTxt}>Sign out</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingBottom: 48 },

    // Header
    appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2 },
    wordmark: { fontFamily: FONTS.heading, fontSize: 22, color: colors.gold, letterSpacing: 0.4 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    currencyChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.goldBg, borderWidth: 1, borderColor: colors.goldDim },
    currencyChipFlag: { fontSize: 14 },
    currencyChipCode: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.gold },
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.goldBg, alignItems: 'center', justifyContent: 'center' },
    avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.goldBg, borderWidth: 1.5, borderColor: colors.goldDim, alignItems: 'center', justifyContent: 'center' },
    avatarLetter: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.gold },

    // Greeting
    greetingBlock: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
    greeting: { fontFamily: FONTS.heading, fontSize: 30, color: colors.textPrimary, marginBottom: 4, lineHeight: 38 },
    subGreeting: { fontFamily: FONTS.regular, fontSize: 14, color: colors.textSecondary },

    // Household banner
    householdBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 16,
      backgroundColor: colors.card, borderRadius: 14, padding: 14,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border,
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: isDark ? 0 : 2,
    },
    hhIconSmall: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    hhBannerTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
    hhBannerSub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },

    // Hero card
    heroCard: {
      marginHorizontal: 20, marginBottom: 24, backgroundColor: colors.card, borderRadius: 20,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border, padding: 20,
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.10, shadowRadius: 12, elevation: isDark ? 0 : 4,
    },
    heroLabel: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
    heroAmount: { fontFamily: FONTS.display, fontSize: 42, color: colors.gold, letterSpacing: -1.5, marginBottom: 18 },
    stackedBar: { flexDirection: 'row', height: 8, borderRadius: 6, overflow: 'hidden', marginBottom: 16 },
    stackedSeg: { height: 8, borderRadius: 2 },
    statsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginBottom: 10 },
    statItem: { flex: 1, alignItems: 'center' },
    statVal: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.textPrimary, marginBottom: 3 },
    statLbl: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted },
    statDiv: { width: 1, height: 30, backgroundColor: colors.border },
    allocBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
    allocBadgeTxt: { fontFamily: FONTS.medium, fontSize: 12, color: colors.success },

    // Section
    section: { paddingHorizontal: 20, marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary },
    sectionCount: { fontFamily: FONTS.medium, fontSize: 13, color: colors.textMuted },

    emptyCard: {
      backgroundColor: colors.card, borderRadius: 16, borderWidth: isDark ? 1 : 0, borderColor: colors.border,
      padding: 32, alignItems: 'center', marginBottom: 12,
    },
    emptyTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary, marginTop: 14, marginBottom: 6 },
    emptySubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

    sourceCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border, padding: 14,
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 2,
    },
    srcIconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    srcInfo: { flex: 1 },
    srcNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    srcName: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary },
    srcSub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },
    srcRight: { alignItems: 'flex-end' },
    srcAmount: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.textPrimary, marginBottom: 3 },
    srcFreq: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted },
    typeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    typeBadgeTxt: { fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.4 },

    addSourceBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginTop: 12, paddingVertical: 16, borderRadius: 14,
      borderWidth: 1.5, borderColor: colors.goldDim, borderStyle: 'dashed', backgroundColor: colors.goldBg,
    },
    addSourceTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.gold },
    longPressHint: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 8 },

    signOutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
    signOutTxt: { fontFamily: FONTS.medium, fontSize: 13, color: colors.textMuted },
  });
}

function makeModalStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: 24, paddingBottom: 40, borderWidth: isDark ? 1 : 0, borderColor: colors.border,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
    title: { fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 20 },
    label: { fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
    input: {
      backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 14, fontFamily: FONTS.medium, fontSize: 15,
      color: colors.textPrimary, marginBottom: 18,
      // Prevent invisible text on Android
      includeFontPadding: false,
    },
    amountRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    amountSym: { fontFamily: FONTS.heading, fontSize: 22, color: colors.gold, marginRight: 8 },
    amountInput: { flex: 1, marginBottom: 0, fontSize: 22, fontFamily: FONTS.heading, color: colors.gold, includeFontPadding: false },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    typePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border },
    typePillTxt: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textSecondary },
    addBtn: { backgroundColor: colors.gold, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 4 },
    addBtnTxt: { fontFamily: FONTS.semibold, fontSize: 15, color: isDark ? colors.bg : '#FFF' },
    cancelRow: { alignItems: 'center', paddingVertical: 12 },
    cancelTxt: { fontFamily: FONTS.medium, fontSize: 14, color: colors.textMuted },

    // Currency picker
    currencyRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
      borderWidth: 1.5, borderColor: colors.border, marginBottom: 10,
    },
    currencyFlag: { fontSize: 24 },
    currencyName: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.textPrimary, marginBottom: 2 },
    currencyCode: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },

    // Household modal
    tabRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 4, marginBottom: 24 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    tabActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2 },
    tabTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textMuted },
    hhHeader: { alignItems: 'center', marginBottom: 24 },
    hhIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.goldBg, borderWidth: 1, borderColor: colors.goldDim, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    hhName: { fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 4 },
    codeCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    codeLabel: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
    codeValue: { fontFamily: FONTS.heading, fontSize: 36, color: colors.gold, letterSpacing: 8, marginBottom: 8 },
    codeHint: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 16 },
    codeActions: { flexDirection: 'row', gap: 12 },
    codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.goldBg, borderWidth: 1, borderColor: colors.goldDim },
    codeBtnTxt: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldBg, borderWidth: 1, borderColor: colors.goldDim, alignItems: 'center', justifyContent: 'center' },
    memberAvatarTxt: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.gold },
    memberName: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
    memberRole: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' },
    ownerBadge: { backgroundColor: colors.goldBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    ownerBadgeTxt: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.gold },
    leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: 12 },
  });
}
