import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, Alert, RefreshControl,
  Pressable, Animated, Share, Clipboard, Switch,
} from 'react-native';
import { calculatePAYE, STATE_OPTIONS, REGIME_LABEL, type NigerianState, type TaxRegime } from '@/utils/taxCalc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { BottomSheetInput } from '@/utils/BottomSheetInput';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BUCKET_COLORS, BUCKET_DEFAULTS, FONTS } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { fmt, formatInput, parseInput, CURRENCIES, CURRENCY_LIST, type CurrencyCode } from '@/utils/currency';
import type { IncomeSource, IncomeType } from '@/types/database';

// ─── Constants ────────────────────────────────────────────────────────────────
const INCOME_TYPES: IncomeType[] = ['SALARY', 'FREELANCE', 'BUSINESS', 'GIFT', 'SIDE INCOME'];

const TYPE_META: Record<IncomeType, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }> = {
  SALARY:        { icon: 'briefcase-outline',  color: '#10B97A', bg: 'rgba(16,185,122,0.12)' },
  FREELANCE:     { icon: 'laptop-outline',     color: '#D4AF37', bg: 'rgba(212,175,55,0.12)' },
  BUSINESS:      { icon: 'business-outline',   color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  GIFT:          { icon: 'gift-outline',       color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  'SIDE INCOME': { icon: 'flash-outline',      color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
};

const TYPE_BADGE: Record<IncomeType, { bg: string; text: string }> = {
  SALARY:        { bg: 'rgba(16,185,122,0.15)',  text: '#10B97A' },
  FREELANCE:     { bg: 'rgba(212,175,55,0.15)',  text: '#D4AF37' },
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
      snapPoints={['90%']}
      enableDynamicSizing={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }}
      >
        <Text style={ms.title}>Add Income Source</Text>

        {/* Source name */}
        <Text style={ms.label}>SOURCE NAME</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="e.g. GTBank Salary"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          onSubmitEditing={() => amountRef.current?.focus()}
          blurOnSubmit={false}
          autoCorrect={false}
          autoFocus={false}
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
          <BottomSheetInput
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
        <BottomSheetInput
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
            <BottomSheetInput
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
            <BottomSheetInput
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

// ─── Smart Allocate Sheet ─────────────────────────────────────────────────────
function SmartAllocateSheet({ visible, onClose, totalIncome, user, household, onApplied, colors, isDark, currency }: {
  visible: boolean; onClose: () => void; totalIncome: number;
  user: any; household: any; onApplied: () => void;
  colors: any; isDark: boolean; currency: CurrencyCode;
}) {
  const sheetRef   = useRef<BottomSheetModal>(null);
  const [amounts, setAmounts] = useState<number[]>(BUCKET_DEFAULTS.map(() => 0));
  const [saving, setSaving]   = useState(false);

  // Pre-fill amounts from income whenever sheet opens
  useEffect(() => {
    if (visible) {
      setAmounts(BUCKET_DEFAULTS.map((b) => Math.round((totalIncome * b.defaultPct) / 100)));
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, totalIncome]);

  const totalAllocated = amounts.reduce((s, a) => s + a, 0);
  const overBudget     = totalIncome > 0 && totalAllocated > totalIncome;
  const remainingAmt   = totalIncome - totalAllocated;

  // Health label for each bucket
  function bucketHealth(name: string, pct: number): { label: string; color: string } {
    if (name === 'Savings' || name === 'Investments') {
      if (pct >= 20) return { label: 'Excellent', color: '#10B97A' };
      if (pct >= 10) return { label: 'Good',      color: '#D4AF37' };
      return             { label: 'Low',           color: '#EF4444' };
    }
    if (name === 'Rent & Housing') {
      if (pct <= 28) return { label: 'Healthy',   color: '#10B97A' };
      if (pct <= 30) return { label: 'Watch',     color: '#D4AF37' };
      return              { label: 'High',         color: '#EF4444' };
    }
    if (name === 'Emergency Fund') {
      if (pct >= 10) return { label: 'Funded',    color: '#10B97A' };
      if (pct >= 5)  return { label: 'Building',  color: '#D4AF37' };
      return              { label: 'Underfunded',  color: '#EF4444' };
    }
    return { label: 'Set', color: '#60A5FA' };
  }

  async function handleApply() {
    if (!user || totalIncome === 0) return;
    setSaving(true);
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const rows  = BUCKET_DEFAULTS.map((b, i) => ({
      user_id:      user.id,
      household_id: household?.id ?? null,
      month, year,
      bucket_name:  b.name,
      amount:       amounts[i],
      pct:          Number(((amounts[i] / totalIncome) * 100).toFixed(2)),
    }));
    const { error } = await (supabase as any)
      .from('allocations')
      .upsert(rows, { onConflict: 'user_id,month,year,bucket_name' });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApplied();
    onClose();
  }

  const sym = CURRENCIES[currency].symbol;
  const ms  = makeModalStyles(colors, isDark);

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['92%']}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      onDismiss={onClose}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4, paddingTop: 4 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.goldBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles-outline" size={18} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 17, color: colors.textPrimary }}>Smart Allocate</Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>Evidence-based budget distribution</Text>
          </View>
        </View>

        {/* Total bar */}
        <View style={{
          backgroundColor: overBudget ? '#EF444415' : colors.goldBg,
          borderRadius: 14, padding: 14, marginTop: 14, marginBottom: 6,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          borderWidth: 1, borderColor: overBudget ? '#EF444430' : colors.gold + '30',
        }}>
          <View>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: colors.textMuted, marginBottom: 1 }}>
              {totalIncome > 0 ? 'Income' : 'No income yet'}
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: colors.gold }}>
              {sym}{totalIncome.toLocaleString('en-NG')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: colors.textMuted, marginBottom: 1 }}>
              {overBudget ? 'Over budget' : remainingAmt === 0 ? 'Fully allocated' : 'Unallocated'}
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: overBudget ? '#EF4444' : remainingAmt === 0 ? '#10B97A' : colors.textSecondary }}>
              {overBudget ? '-' : ''}{sym}{Math.abs(remainingAmt).toLocaleString('en-NG')}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        {totalIncome > 0 && (
          <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
            <View style={{
              height: 4, borderRadius: 2,
              backgroundColor: overBudget ? '#EF4444' : totalAllocated === totalIncome ? '#10B97A' : colors.gold,
              width: `${Math.min((totalAllocated / totalIncome) * 100, 100)}%` as any,
            }} />
          </View>
        )}

        {/* Bucket rows */}
        <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted, letterSpacing: 2, marginBottom: 10 }}>
          BUDGET BUCKETS — ADJUST AS NEEDED
        </Text>

        {BUCKET_DEFAULTS.map((bucket, i) => {
          const pct    = totalIncome > 0 ? (amounts[i] / totalIncome) * 100 : 0;
          const health = bucketHealth(bucket.name, pct);
          return (
            <View key={bucket.name} style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 14,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              {/* Row: icon + name + health badge + input */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bucket.color + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ionicons name={bucket.icon as any} size={17} color={bucket.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: colors.textPrimary }}>{bucket.name}</Text>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }}>
                    Suggested {bucket.defaultPct}%
                  </Text>
                </View>
                {/* Health badge */}
                <View style={{ backgroundColor: health.color + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: health.color }}>{health.label}</Text>
                </View>
              </View>

              {/* Amount input + pct */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.textMuted, marginRight: 4 }}>{sym}</Text>
                  <BottomSheetInput
                    style={{ flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: colors.textPrimary, includeFontPadding: false }}
                    value={amounts[i] > 0 ? formatInput(amounts[i].toString()) : ''}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    returnKeyType="done"
                    cursorColor={colors.gold}
                    selectTextOnFocus
                    onChangeText={(v) => {
                      const n = parseInput(v);
                      setAmounts((prev) => prev.map((a, idx) => idx === i ? n : a));
                    }}
                  />
                </View>
                <View style={{ width: 52, alignItems: 'center', backgroundColor: bucket.color + '18', borderRadius: 10, paddingVertical: 10 }}>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 15, color: bucket.color }}>
                    {totalIncome > 0 ? `${Math.round(pct)}%` : '—'}
                  </Text>
                </View>
              </View>

              {/* Mini fill bar */}
              {totalIncome > 0 && (
                <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                  <View style={{ height: 3, backgroundColor: health.color, borderRadius: 2, width: `${Math.min(pct / bucket.defaultPct, 1) * 100}%` as any }} />
                </View>
              )}
            </View>
          );
        })}

        {/* Apply button */}
        <TouchableOpacity
          onPress={handleApply}
          disabled={saving || totalIncome === 0}
          activeOpacity={0.87}
          style={{
            borderRadius: 16, overflow: 'hidden', marginTop: 8,
            opacity: totalIncome === 0 ? 0.5 : 1,
          }}
        >
          <LinearGradient
            colors={['#4E0B0B', '#210909']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ height: 58, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, borderRadius: 16 }}
          >
            {saving
              ? <ActivityIndicator color={colors.gold} />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.gold} />
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold, letterSpacing: 2 }}>
                    APPLY ALLOCATIONS
                  </Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>

        {totalIncome === 0 && (
          <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
            Add at least one income source to use Smart Allocate
          </Text>
        )}

        <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingVertical: 14 }}>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted }}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Tax Reserve Sheet ───────────────────────────────────────────────────────
type IncomeKind   = 'gross' | 'net';
type DeductedKind = 'yes' | 'no' | null;

const SALARY_TYPES: IncomeType[] = ['SALARY'];
const OTHER_TYPES:  IncomeType[] = ['FREELANCE', 'BUSINESS', 'GIFT', 'SIDE INCOME'];

function TaxReserveSheet({ visible, onClose, sources, colors, isDark, currency, userId, householdId, onSaved }: {
  visible: boolean; onClose: () => void; sources: IncomeSource[];
  colors: any; isDark: boolean; currency: string;
  userId: string; householdId: string | null;
  onSaved: () => void;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);

  // ── Derived income split ────────────────────────────────────────────────────
  // Salary sources → gross/net question applies
  // Other sources (Freelance, Business, Gift, Side Income) → always gross, always taxed
  const salarySources = sources.filter((s) => SALARY_TYPES.includes(s.type as IncomeType));
  const otherSources  = sources.filter((s) => OTHER_TYPES.includes(s.type as IncomeType));
  const monthlySalaryDefault = Math.round(salarySources.reduce((a, s) => a + s.amount, 0));
  const monthlyOther         = Math.round(otherSources.reduce((a, s) => a + s.amount, 0));

  // ── Form state ──────────────────────────────────────────────────────────────
  const [nigerianState, setNigerianState]     = useState<NigerianState>('Lagos');
  const [regime, setRegime]                   = useState<TaxRegime>('PITA_2024');
  const [overrideRegime, setOverrideRegime]   = useState(false);
  const [salaryText, setSalaryText]           = useState('');

  // Salary: gross vs net (only applies to SALARY type)
  const [incomeKind, setIncomeKind]           = useState<IncomeKind>('gross');
  // Net: has employer already deducted PAYE?
  const [deducted, setDeducted]               = useState<DeductedKind>(null);
  // Net + deducted: how much was deducted?
  const [deductedAmtText, setDeductedAmtText] = useState('');

  const [saving, setSaving] = useState(false);

  // ── Open / close ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setSalaryText(monthlySalaryDefault > 0 ? String(monthlySalaryDefault) : '');
      setIncomeKind('gross');
      setDeducted(null);
      setDeductedAmtText('');
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, monthlySalaryDefault]);

  // ── Numbers ─────────────────────────────────────────────────────────────────
  const monthlySalary = parseFloat(salaryText.replace(/,/g, '')) || 0;
  const deductedAmt   = parseFloat(deductedAmtText.replace(/,/g, '')) || 0;
  const forceRegime   = overrideRegime ? regime : undefined;

  // Determine what PAYE calculation to run
  // Case A: Gross salary (or net + employer hasn't deducted yet)
  //   → run PAYE on (salary + other income) combined
  // Case B: Net + employer already deducted
  //   → PAYE on other income only (salary tax is employer's job)
  //   → total = deductedAmt (recorded) + otherIncomeTax
  const hasSalary    = salarySources.length > 0;
  const needDeductedAnswer = hasSalary && incomeKind === 'net' && deducted === null;
  const showDeductedInput  = hasSalary && incomeKind === 'net' && deducted === 'yes';

  // Which amount feeds the combined PAYE calc?
  const combinedMonthlyForCalc =
    showDeductedInput
      ? monthlyOther          // salary handled by employer, only tax other sources
      : monthlySalary + monthlyOther;

  const showCalculator = combinedMonthlyForCalc > 0 &&
    (incomeKind === 'gross' || deducted === 'no' || showDeductedInput);

  const result = showCalculator
    ? calculatePAYE(combinedMonthlyForCalc * 12, nigerianState, undefined, forceRegime)
    : null;

  // Total monthly tax to reserve
  const totalMonthlyTax = showDeductedInput
    ? (result ? Math.round(result.monthlyTax) : 0) + deductedAmt   // other + employer-deducted
    : result ? Math.round(result.monthlyTax) : 0;                   // combined

  // ── Save (delete-then-insert to avoid missing unique constraint) ─────────────
  async function upsertTaxReserve(reserveAmount: number, effectiveRate: number) {
    const db    = supabase as any;
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    let delQ = db.from('allocations').delete()
      .eq('user_id', userId).eq('month', month).eq('year', year)
      .eq('bucket_name', 'Tax Reserve');
    delQ = householdId ? delQ.eq('household_id', householdId) : delQ.is('household_id', null);
    await delQ;
    const { error } = await db.from('allocations').insert({
      user_id: userId, household_id: householdId,
      month, year, bucket_name: 'Tax Reserve',
      amount: reserveAmount,
      pct: parseFloat(effectiveRate.toFixed(1)),
    });
    return error;
  }

  // ── Apply ───────────────────────────────────────────────────────────────────
  async function handleApply() {
    if (!userId) return;

    if (showDeductedInput) {
      // Employer handles salary PAYE; we may still owe tax on other income
      if (deductedAmt <= 0) {
        Alert.alert('Amount required', 'Enter the monthly PAYE your employer deducts from your payslip.');
        return;
      }
      const otherMonthlyTax = result ? Math.round(result.monthlyTax) : 0;
      const totalReserve = deductedAmt + otherMonthlyTax;

      setSaving(true);
      const totalIncome = monthlySalary + monthlyOther;
      const effectiveRate = totalIncome > 0 ? (totalReserve / totalIncome) * 100 : 0;
      const error = await upsertTaxReserve(totalReserve, effectiveRate);
      setSaving(false);
      if (error) { Alert.alert('Error', error.message); return; }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const lines = [
        `Employer deducts: ${fmt(deductedAmt, currency as any)}/month`,
        ...(otherMonthlyTax > 0
          ? [`Other income tax: ${fmt(otherMonthlyTax, currency as any)}/month`, `Total recorded: ${fmt(totalReserve, currency as any)}/month`]
          : [`No additional tax on other income.`]),
      ];
      Alert.alert('Tax Reserve Recorded', lines.join('\n'), [
        { text: 'Done', onPress: () => { onSaved(); onClose(); } },
      ]);
      return;
    }

    // Gross or net-not-yet-deducted — use the combined PAYE result
    if (!result) return;
    if (result.isExempt && monthlyOther === 0) return;

    const reserveAmount = Math.round(result.monthlyTax);
    setSaving(true);
    const totalIncome = monthlySalary + monthlyOther;
    const error = await upsertTaxReserve(reserveAmount, result.effectiveRate);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const modeNote = incomeKind === 'net' && deducted === 'no'
      ? '\n\nNote: Calculated on your net salary as an estimate — actual gross may be slightly higher.'
      : '';
    Alert.alert(
      'Tax Reserve Applied',
      `${fmt(reserveAmount, currency as any)}/month reserved for PAYE.\n\nRegime: ${REGIME_LABEL[result.regime]}\nEffective rate: ${result.effectiveRate.toFixed(1)}%${modeNote}`,
      [{ text: 'Done', onPress: () => { onSaved(); onClose(); } }],
    );
  }

  // ── Style helpers ───────────────────────────────────────────────────────────
  const fmtN = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const iStyle: any = {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: FONTS.medium, fontSize: 15, color: colors.textPrimary, marginBottom: 20,
  };
  const labelStyle: any = {
    fontFamily: FONTS.semibold, fontSize: 10, color: colors.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  };
  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['92%']}
      enableDynamicSizing={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card, borderRadius: 28 }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      onDismiss={onClose}
    >
      <BottomSheetScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }}>

        {/* Header */}
        <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginTop: 8, marginBottom: 4 }}>
          Tax Reserves
        </Text>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginBottom: 20, lineHeight: 20 }}>
          Nigerian PAYE — Lagos, Abuja (FCT) & Enugu. Calculates tax across all your income sources.
        </Text>

        {/* ── Residential State ────────────────────────────────── */}
        <Text style={labelStyle}>Residential State</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {STATE_OPTIONS.map((s) => {
            const active = nigerianState === s;
            return (
              <TouchableOpacity key={s} onPress={() => setNigerianState(s)} activeOpacity={0.8}
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
                  backgroundColor: active ? colors.infoBg : colors.surface,
                  borderWidth: 1.5, borderColor: active ? colors.info : colors.border }}>
                <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: active ? colors.info : colors.textSecondary }}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Salary section (gross/net only for SALARY) ─────── */}
        {hasSalary ? (
          <>
            <Text style={labelStyle}>Salary Income</Text>

            {/* Gross / Net toggle */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, padding: 4, marginBottom: 12 }}>
              {(['gross', 'net'] as IncomeKind[]).map((k) => {
                const active = incomeKind === k;
                return (
                  <TouchableOpacity key={k}
                    onPress={() => { setIncomeKind(k); setDeducted(null); setDeductedAmtText(''); }}
                    activeOpacity={0.8}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center',
                      backgroundColor: active ? colors.info : 'transparent' }}>
                    <Text style={{ fontFamily: FONTS.semibold, fontSize: 14,
                      color: active ? '#fff' : colors.textSecondary, textTransform: 'capitalize' }}>{k}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginBottom: 14, lineHeight: 18 }}>
              {incomeKind === 'gross'
                ? 'Before any deductions — PAYE will be calculated on your full salary.'
                : 'Amount received after employer deductions — we will ask if tax was already removed.'}
            </Text>

            {/* Salary amount input */}
            <Text style={labelStyle}>Monthly {incomeKind === 'gross' ? 'Gross' : 'Net'} Salary</Text>
            <BottomSheetInput
              style={iStyle}
              placeholder="e.g. 500000"
              placeholderTextColor={colors.textMuted}
              value={salaryText}
              onChangeText={(v: string) => setSalaryText(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              returnKeyType="done"
              cursorColor={colors.gold}
            />

            {/* Net: employer deduction question */}
            {incomeKind === 'net' && monthlySalary > 0 && (
              <View style={{ backgroundColor: colors.goldBg, borderRadius: 16, padding: 16, marginBottom: 20,
                borderWidth: 1, borderColor: colors.gold + '40' }}>
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>
                  Has your employer already deducted PAYE?
                </Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginBottom: 14, lineHeight: 18 }}>
                  Most formal employees have PAYE withheld at source before receiving take-home pay.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {(['yes', 'no'] as const).map((opt) => {
                    const active = deducted === opt;
                    return (
                      <TouchableOpacity key={opt} onPress={() => setDeducted(opt)} activeOpacity={0.8}
                        style={{ flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
                          backgroundColor: active ? (opt === 'yes' ? colors.successBg : colors.dangerBg) : colors.surface,
                          borderWidth: 1.5, borderColor: active ? (opt === 'yes' ? colors.success : colors.danger) : colors.border }}>
                        <Text style={{ fontFamily: FONTS.semibold, fontSize: 13,
                          color: active ? (opt === 'yes' ? colors.success : colors.danger) : colors.textSecondary }}>
                          {opt === 'yes' ? 'Yes, deducted' : 'No, not yet'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Net + already deducted: enter deducted amount */}
            {showDeductedInput && (
              <>
                <Text style={labelStyle}>PAYE deducted by employer / month</Text>
                <BottomSheetInput
                  style={iStyle}
                  placeholder="e.g. 45000  (from your payslip)"
                  placeholderTextColor={colors.textMuted}
                  value={deductedAmtText}
                  onChangeText={(v: string) => setDeductedAmtText(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  returnKeyType="done"
                  cursorColor={colors.gold}
                />
              </>
            )}
          </>
        ) : (
          /* No salary sources — skip salary section entirely */
          null
        )}

        {/* ── Other income sources (always gross) ───────────── */}
        {otherSources.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 20 }}>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: colors.textPrimary, marginBottom: 10 }}>
              Other Income Sources
              <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }}> — always taxed as gross</Text>
            </Text>
            {otherSources.map((src) => (
              <View key={src.id} style={{ flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={TYPE_META[src.type as IncomeType]?.icon ?? 'cash-outline'} size={14} color={colors.gold} />
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary }}>{src.name}</Text>
                  <View style={{ backgroundColor: colors.goldBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: colors.gold }}>{src.type}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: colors.textPrimary }}>{fmt(src.amount, currency as any)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.textMuted }}>Total other / month</Text>
              <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold }}>{fmt(monthlyOther, currency as any)}</Text>
            </View>
          </View>
        )}

        {/* ── 2026 regime toggle ────────────────────────────── */}
        {(showCalculator || showDeductedInput) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 20 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textPrimary }}>Preview 2026 Tax Reform</Text>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>NTA 2025 — effective 1 Jan 2026</Text>
            </View>
            <Switch
              value={overrideRegime}
              onValueChange={(v) => { setOverrideRegime(v); setRegime(v ? 'NTA_2025' : 'PITA_2024'); }}
              trackColor={{ false: colors.border, true: colors.burgundy }}
              thumbColor={overrideRegime ? colors.gold : colors.card}
            />
          </View>
        )}

        {/* ── Net-not-deducted estimate warning ─────────────── */}
        {incomeKind === 'net' && deducted === 'no' && (
          <View style={{ backgroundColor: colors.warningBg, borderRadius: 12, padding: 12,
            borderWidth: 1, borderColor: colors.warning + '40', marginBottom: 16,
            flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Ionicons name="information-circle-outline" size={18} color={colors.warning} style={{ marginTop: 1 }} />
            <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.warning, flex: 1, lineHeight: 18 }}>
              Using your net salary as an approximation — actual gross is slightly higher, so this is a conservative figure.
            </Text>
          </View>
        )}

        {/* ── PAYE Results ─────────────────────────────────── */}
        {result && (
          <>
            {/* Summary card */}
            <View style={{ backgroundColor: colors.infoBg, borderRadius: 16, padding: 20, alignItems: 'center',
              marginBottom: 20, borderWidth: 1, borderColor: colors.info + '40' }}>
              {result.isExempt && monthlyOther === 0 ? (
                <>
                  <Text style={{ fontFamily: FONTS.heading, fontSize: 28, color: colors.success }}>Exempt</Text>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center', lineHeight: 20 }}>
                    {'Income below ₦840,000/year threshold\n— no PAYE deductible'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                    {showDeductedInput ? 'Tax on Other Income / month' : 'Monthly PAYE to Reserve'}
                  </Text>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 40, color: colors.info, letterSpacing: -1 }}>
                    {fmt(result.monthlyTax, currency as any)}
                  </Text>
                  {showDeductedInput && deductedAmt > 0 && (
                    <>
                      <View style={{ width: '80%', height: 1, backgroundColor: colors.border, marginVertical: 10 }} />
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>+ Employer deducts</Text>
                      <Text style={{ fontFamily: FONTS.semibold, fontSize: 20, color: colors.success, marginTop: 2 }}>
                        {fmt(deductedAmt, currency as any)}
                      </Text>
                      <View style={{ width: '80%', height: 1, backgroundColor: colors.border, marginVertical: 10 }} />
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>Total Tax / month</Text>
                      <Text style={{ fontFamily: FONTS.display, fontSize: 32, color: colors.gold, letterSpacing: -1, marginTop: 2 }}>
                        {fmt(totalMonthlyTax, currency as any)}
                      </Text>
                    </>
                  )}
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
                    {result.effectiveRate.toFixed(1)}% effective rate · {REGIME_LABEL[result.regime]}
                  </Text>
                </>
              )}
            </View>

            {/* Annual breakdown */}
            <Text style={labelStyle}>Annual Breakdown</Text>
            {[
              { label: showDeductedInput ? 'Other Income (Gross)' : 'Total Gross Income', val: result.annualGross, color: colors.textPrimary },
              { label: 'Pension Deduction (8%)',  val: -result.pensionDeduction,  color: colors.warning       },
              ...(result.cra > 0 ? [{ label: 'Consolidated Relief (CRA)', val: -result.cra, color: colors.emerald }] : []),
              { label: 'Taxable Income',          val: result.taxableIncome,      color: colors.textSecondary },
              { label: showDeductedInput ? 'PAYE on Other Income' : 'Annual PAYE Tax',
                val: result.effectiveAnnualTax,   color: colors.danger },
              ...(showDeductedInput && deductedAmt > 0 ? [
                { label: 'Salary PAYE (Employer)', val: deductedAmt * 12, color: colors.success },
              ] : []),
              { label: 'Net Annual Income',       val: result.netAnnualIncome,    color: colors.gold          },
            ].map(({ label, val, color }) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 14, color: colors.textMuted }}>{label}</Text>
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color }}>
                  {val < 0 ? '-' : ''}₦{fmtN(Math.abs(val))}
                </Text>
              </View>
            ))}

            {/* Band breakdown */}
            {result.bands.length > 0 && (
              <>
                <Text style={[labelStyle, { marginTop: 20 }]}>Tax Band Breakdown</Text>
                {result.bands.map((band, i) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, flex: 1, marginRight: 8 }}>{band.label}</Text>
                      <Text style={{ fontFamily: FONTS.medium, fontSize: 12, color: colors.info }}>₦{fmtN(band.taxDue)}</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: 4, backgroundColor: colors.info, borderRadius: 2,
                        width: `${result.effectiveAnnualTax > 0 ? Math.min((band.taxDue / result.effectiveAnnualTax) * 100, 100) : 0}%` }} />
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Authority */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 16, marginBottom: 24 }}>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                <Text style={{ fontFamily: FONTS.semibold }}>Authority: </Text>
                {result.stateAuthority}{'\n'}
                Rates sourced from PwC, EY & KPMG Nigeria 2024/2025. Consult a certified tax professional for payroll filing.
              </Text>
            </View>
          </>
        )}

        {/* ── Apply buttons ─────────────────────────────────── */}

        {/* Case 1: Gross / net-not-yet-deducted → reserve calculated PAYE */}
        {result && !result.isExempt && !showDeductedInput && (
          <TouchableOpacity
            style={{ backgroundColor: colors.info, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 4, opacity: saving ? 0.7 : 1 }}
            onPress={handleApply} disabled={saving} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontFamily: FONTS.semibold, fontSize: 16, color: '#fff' }}>
                  Reserve {fmt(Math.round(result.monthlyTax), currency as any)}/month
                </Text>
            }
          </TouchableOpacity>
        )}

        {/* Case 2: Net + already deducted → record employer amount + other income tax */}
        {showDeductedInput && deductedAmt > 0 && (
          <TouchableOpacity
            style={{ backgroundColor: totalMonthlyTax > deductedAmt ? colors.info : colors.success,
              borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 4, opacity: saving ? 0.7 : 1 }}
            onPress={handleApply} disabled={saving} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontFamily: FONTS.semibold, fontSize: 16, color: '#fff' }}>
                  {totalMonthlyTax > deductedAmt
                    ? `Record ${fmt(totalMonthlyTax, currency as any)}/month total`
                    : `Record ${fmt(deductedAmt, currency as any)}/month`}
                </Text>
            }
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted }}>Close</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function IncomeSetupScreen() {
  const { colors, isDark, toggleColorMode } = useTheme();
  const { user, profile, household, householdMembers, currency, signOut, setCurrency, refreshHousehold } = useAuth();
  const router = useRouter();

  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allocPct, setAllocPct]   = useState(0);
  const [showAdd, setShowAdd]               = useState(false);
  const [showCurrency, setShowCurrency]     = useState(false);
  const [showHousehold, setShowHousehold]   = useState(false);
  const [showSmartAllocate, setShowSmartAllocate] = useState(false);
  const [showTaxReserve, setShowTaxReserve] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;

  const firstName = profile?.name?.split(' ')[0] ?? 'there';
  const totalIncome = sources.reduce((s, src) => s + src.amount, 0);
  const isFullyAllocated = allocPct >= 99;
  const remaining = totalIncome > 0 ? Math.round(totalIncome * (1 - allocPct / 100)) : 0;

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

  // ── Helper: format large numbers compactly (e.g. ₦540K) ─────────────────────
  function fmtCompact(amount: number): string {
    const sym = CURRENCIES[currency].symbol;
    if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${sym}${Math.round(amount / 1_000)}K`;
    return `${sym}${amount}`;
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

      <SmartAllocateSheet
        visible={showSmartAllocate}
        onClose={() => setShowSmartAllocate(false)}
        totalIncome={totalIncome}
        user={user}
        household={household}
        onApplied={loadAllocPct}
        colors={colors}
        isDark={isDark}
        currency={currency}
      />

      <TaxReserveSheet
        visible={showTaxReserve}
        onClose={() => setShowTaxReserve(false)}
        totalMonthlyIncome={totalIncome}
        colors={colors}
        isDark={isDark}
        currency={currency}
        userId={user?.id ?? ''}
        householdId={household?.id ?? null}
        onSaved={loadAllocPct}
      />

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
            {/* Currency chip */}
            <TouchableOpacity style={s.currencyChip} onPress={() => setShowCurrency(true)} activeOpacity={0.75}>
              <Text style={s.currencyChipFlag}>{CURRENCIES[currency].flag}</Text>
              <Text style={s.currencyChipCode}>{currency}</Text>
            </TouchableOpacity>
            {/* Transactions */}
            <TouchableOpacity style={s.themeToggle} onPress={() => router.push('/transactions' as any)} activeOpacity={0.75}>
              <Ionicons name="receipt-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {/* Theme toggle */}
            <TouchableOpacity style={s.themeToggle} onPress={toggleColorMode} activeOpacity={0.75}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {/* Avatar / account */}
            <TouchableOpacity style={s.avatarBtn}
              onPress={() => router.push('/settings' as any)}
              activeOpacity={0.8}>
              <Text style={s.avatarLetter}>{(profile?.name ?? 'U').charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Greeting ───────────────────────────────────── */}
        <View style={s.greetingBlock}>
          <Text style={s.greetingLine}>{getGreeting()},</Text>
          <Text style={s.greetingName}>{firstName}</Text>
          <Text style={s.greetingMeta}>{getMonth()} · Income</Text>
        </View>

        {/* ── Household Banner ────────────────────────────── */}
        {household ? (
          <TouchableOpacity style={s.hhBanner} onPress={() => setShowHousehold(true)} activeOpacity={0.8}>
            <Ionicons name="people" size={16} color={colors.gold} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.hhBannerTitle}>{household.name}</Text>
              <Text style={s.hhBannerSub}>
                {householdMembers.length} member{householdMembers.length !== 1 ? 's' : ''} · Tap to manage
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.hhBannerEmpty} onPress={() => setShowHousehold(true)} activeOpacity={0.8}>
            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.hhBannerEmptyTitle}>Budget together with your partner</Text>
              <Text style={s.hhBannerSub}>Create or join a household</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* ── Hero Card ───────────────────────────────────── */}
        <LinearGradient
          colors={isDark ? ['#2e1413', '#4E0B0B'] : ['#7B1515', '#4E0B0B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.heroCard}
        >
          {/* Decorative gold ambient glow */}
          <View style={s.heroGlow} pointerEvents="none" />

          {/* Top section */}
          <View style={s.heroTop}>
            {/* Row 1: label + month */}
            <View style={s.heroLabelRow}>
              <Text style={s.heroLabel}>TOTAL MONTHLY INCOME</Text>
              <Text style={s.heroMonth}>{getMonth()}</Text>
            </View>

            {/* Amount */}
            {totalIncome > 0 ? (
              <View style={s.heroAmountRow}>
                <Text style={s.heroCurrSym}>{CURRENCIES[currency].symbol}</Text>
                <Text style={s.heroAmountNum}>
                  {totalIncome.toLocaleString('en-NG')}
                </Text>
              </View>
            ) : (
              <Text style={s.heroEmptyAmt}>Add income sources</Text>
            )}

            {/* Allocation bar */}
            <View style={s.allocBarTrack}>
              {totalIncome > 0 && allocPct > 0 ? (
                <View style={[s.allocBarFill, { width: `${Math.min(allocPct, 100)}%` as any }]} />
              ) : totalIncome > 0 ? (
                <View style={[s.allocBarFill, { width: '0%' as any }]} />
              ) : null}
            </View>
          </View>

          {/* Divider */}
          <View style={s.heroDivider} />

          {/* Stats row */}
          <View style={s.heroStats}>
            <View style={s.heroStatCol}>
              <Text style={s.heroStatVal}>{sources.length}</Text>
              <Text style={s.heroStatLbl}>Sources</Text>
            </View>
            <View style={s.heroStatLine} />
            <View style={s.heroStatCol}>
              <Text style={[s.heroStatVal, { color: isFullyAllocated ? colors.emerald : colors.gold }]}>
                {allocPct}%
              </Text>
              <Text style={s.heroStatLbl}>Allocated</Text>
            </View>
            <View style={s.heroStatLine} />
            <View style={s.heroStatCol}>
              <Text style={[s.heroStatVal, { color: remaining > 0 ? colors.warning : colors.success }]}>
                {fmtCompact(remaining)}
              </Text>
              <Text style={s.heroStatLbl}>Remaining</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Income Sources ─────────────────────────────── */}
        <View style={s.section}>
          {/* Section header */}
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderLeft}>
              <Text style={s.sectionTitle}>Income Sources</Text>
              {sources.length > 0 && (
                <View style={s.countBadge}>
                  <Text style={s.countBadgeTxt}>{sources.length}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={s.addIconBtn} onPress={() => setShowAdd(true)} activeOpacity={0.75}>
              <Ionicons name="add" size={20} color={colors.gold} />
            </TouchableOpacity>
          </View>

          {sources.length === 0 ? (
            /* ── Empty state ── */
            <View style={s.emptyState}>
              <Ionicons name="wallet-outline" size={64} color={colors.textMuted} />
              <Text style={s.emptyTitle}>No income sources yet</Text>
              <Text style={s.emptySubtitle}>
                Add your salary, freelance work, or any regular income to get started.
              </Text>
              <TouchableOpacity style={s.emptyAddBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
                <Text style={s.emptyAddBtnTxt}>Add Income Source</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sources.map((src) => {
              const meta = TYPE_META[src.type] ?? TYPE_META.SALARY;
              const badge = TYPE_BADGE[src.type] ?? TYPE_BADGE.SALARY;
              const isOwn = src.user_id === user?.id;
              return (
                <TouchableOpacity key={src.id}
                  style={s.sourceCard}
                  activeOpacity={0.75}
                  onLongPress={() => deleteSource(src.id, src.user_id)}>
                  {/* Icon */}
                  <View style={[s.srcIconWrap, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  {/* Info */}
                  <View style={s.srcInfo}>
                    <Text style={s.srcName}>{src.name}</Text>
                    <Text style={s.srcSub}>
                      {src.subtitle ?? 'Income source'}
                      {household && !isOwn ? ' · Partner' : ''}
                    </Text>
                  </View>
                  {/* Right: amount + type badge */}
                  <View style={s.srcRight}>
                    <Text style={s.srcAmount}>{fmt(src.amount, currency)}</Text>
                    <View style={[s.typeBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[s.typeBadgeTxt, { color: badge.text }]}>{src.type}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {sources.length > 0 && (
            <Text style={s.longPressHint}>Long-press a card to remove it</Text>
          )}
        </View>

        {/* ── Bento Action Cards ─────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 8 }}>
          <TouchableOpacity
            style={[s.bentoCard, { flex: 1 }]}
            activeOpacity={0.8}
            onPress={() => setShowSmartAllocate(true)}
          >
            <View style={[s.bentoIcon, { backgroundColor: colors.goldBg }]}>
              <Ionicons name="sparkles-outline" size={18} color={colors.gold} />
            </View>
            <Text style={s.bentoBoldText}>Smart Allocate</Text>
            <Text style={s.bentoSubText}>Auto-distribute income</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.bentoCard, { flex: 1 }]}
            activeOpacity={0.8}
            onPress={() => setShowTaxReserve(true)}
          >
            <View style={[s.bentoIcon, { backgroundColor: colors.infoBg }]}>
              <Ionicons name="calculator-outline" size={18} color={colors.info} />
            </View>
            <Text style={s.bentoBoldText}>Tax Reserves</Text>
            <Text style={s.bentoSubText}>Calculate PAYE tax</Text>
          </TouchableOpacity>
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
    scrollContent: { paddingBottom: 56 },

    // ── Header ──────────────────────────────────────────────────────────────
    appHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 6,
    },
    wordmark: {
      fontFamily: FONTS.display,
      fontSize: 24,
      color: colors.gold,
      letterSpacing: -0.5,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    currencyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.goldBg,
    },
    currencyChipFlag: { fontSize: 14 },
    currencyChipCode: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.gold },
    themeToggle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: isDark ? colors.bg : '#FFFFFF',
    },

    // ── Greeting ────────────────────────────────────────────────────────────
    greetingBlock: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 4,
    },
    greetingLine: {
      fontFamily: FONTS.regular,
      fontSize: 15,
      color: colors.textSecondary,
    },
    greetingName: {
      fontFamily: FONTS.display,
      fontSize: 34,
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    greetingMeta: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },

    // ── Household banners ────────────────────────────────────────────────────
    hhBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 0,
      backgroundColor: colors.goldBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.gold + '30',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    hhBannerTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary, marginBottom: 1 },
    hhBannerSub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },

    hhBannerEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 0,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    hhBannerEmptyTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textPrimary, marginBottom: 1 },

    // ── Hero Card ────────────────────────────────────────────────────────────
    heroCard: {
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 24,
      borderRadius: 24,
      overflow: 'hidden',
      ...(isDark
        ? { borderWidth: 1, borderColor: colors.border }
        : {
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.10,
            shadowRadius: 16,
            elevation: 6,
          }),
    },
    heroGlow: {
      position: 'absolute',
      top: -40,
      right: -40,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: colors.goldBg,
    },
    heroTop: { padding: 20 },
    heroLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroLabel: {
      fontFamily: FONTS.semibold,
      fontSize: 10,
      color: 'rgba(255,255,255,0.55)',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    heroMonth: { fontFamily: FONTS.regular, fontSize: 12, color: 'rgba(255,255,255,0.55)' },
    heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 },
    heroCurrSym: {
      fontFamily: FONTS.headingItalic,
      fontSize: 22,
      color: colors.goldLight,
      marginRight: 4,
      paddingBottom: 5,
    },
    heroAmountNum: {
      fontFamily: FONTS.headingItalic,
      fontSize: 42,
      color: colors.goldLight,
      letterSpacing: -1.5,
    },
    heroEmptyAmt: {
      fontFamily: FONTS.headingItalic,
      fontSize: 22,
      color: 'rgba(255,255,255,0.45)',
      marginTop: 10,
    },
    allocBarTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
      overflow: 'hidden',
      marginTop: 20,
    },
    allocBarFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.goldLight,
    },
    heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginTop: 16 },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    heroStatCol: { flex: 1, alignItems: 'center' },
    heroStatVal: {
      fontFamily: FONTS.semibold,
      fontSize: 16,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: 3,
    },
    heroStatLbl: { fontFamily: FONTS.regular, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
    heroStatLine: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

    // ── Income Sources section ───────────────────────────────────────────────
    section: { paddingHorizontal: 20, marginBottom: 28 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary },
    countBadge: {
      backgroundColor: colors.goldBg,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    countBadgeTxt: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.gold },
    addIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Empty state
    emptyState: { alignItems: 'center', marginTop: 48, paddingHorizontal: 20 },
    emptyTitle: {
      fontFamily: FONTS.heading,
      fontSize: 20,
      color: colors.textPrimary,
      marginTop: 20,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 260,
      marginTop: 8,
    },
    emptyAddBtn: {
      backgroundColor: colors.gold,
      borderRadius: 14,
      height: 48,
      width: 200,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
    },
    emptyAddBtnTxt: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: isDark ? colors.bg : '#FFFFFF',
    },

    // Source cards
    sourceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 4,
      elevation: isDark ? 0 : 2,
    },
    srcIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    srcInfo: { flex: 1, marginLeft: 12 },
    srcName: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.textPrimary },
    srcSub: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
    srcRight: { alignItems: 'flex-end' },
    srcAmount: { fontFamily: FONTS.semibold, fontSize: 17, color: colors.textPrimary, marginBottom: 4 },
    typeBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 20,
    },
    typeBadgeTxt: { fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.3 },

    longPressHint: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },

    // Bento action cards
    bentoCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 4,
      elevation: isDark ? 0 : 2,
    },
    bentoIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    bentoBoldText: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    bentoSubText: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textMuted,
    },

    // Sign out
    signOutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 16,
    },
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
