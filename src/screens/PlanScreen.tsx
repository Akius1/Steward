import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
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
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt } from '@/utils/currency';

// ─── Constants ────────────────────────────────────────────────────────────────

const MILESTONE_ICONS = [
  { icon: 'car-outline', color: '#60A5FA', label: 'Car' },
  { icon: 'home-outline', color: '#10B97A', label: 'House' },
  { icon: 'business-outline', color: '#C9943F', label: 'Apartment' },
  { icon: 'school-outline', color: '#A78BFA', label: 'Education' },
  { icon: 'airplane-outline', color: '#F472B6', label: 'Travel' },
  { icon: 'diamond-outline', color: '#F59E0B', label: 'Wedding' },
  { icon: 'medkit-outline', color: '#34D399', label: 'Medical' },
  { icon: 'flag-outline', color: '#818CF8', label: 'Other' },
] as const;

const FUND_TEMPLATES = [
  { name: 'Annual Rent', icon: 'home-outline', color: '#C9943F', suggestedPct: 25 },
  { name: 'School Fees', icon: 'school-outline', color: '#A78BFA', suggestedPct: 15 },
  { name: 'Car Maintenance', icon: 'car-outline', color: '#60A5FA', suggestedPct: 5 },
  { name: 'Christmas Fund', icon: 'gift-outline', color: '#F472B6', suggestedPct: 3 },
  { name: 'Travel Fund', icon: 'airplane-outline', color: '#34D399', suggestedPct: 5 },
  { name: 'Medical Reserve', icon: 'medkit-outline', color: '#EF4444', suggestedPct: 5 },
  { name: 'Tech Upgrade', icon: 'phone-portrait-outline', color: '#818CF8', suggestedPct: 3 },
  { name: 'Emergency Buffer', icon: 'shield-checkmark-outline', color: '#F59E0B', suggestedPct: 10 },
] as const;

const SWATCH_COLORS = [
  '#C9943F', '#10B97A', '#60A5FA', '#A78BFA', '#F472B6',
  '#F59E0B', '#34D399', '#818CF8', '#EF4444', '#06B6D4',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string;
  user_id: string;
  household_id: string | null;
  name: string;
  icon: string;
  target_amount: number;
  saved_amount: number;
  monthly_saving: number;
  deadline_months: number | null;
  created_at: string;
}

interface SinkingFund {
  id: string;
  user_id: string;
  household_id: string | null;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  saved_amount: number;
  monthly_target: number;
  created_at: string;
}

type MilestoneStatus = 'Completed' | 'Ahead' | 'On Track' | 'At Risk' | 'No deadline';

function getMilestoneStatus(m: Milestone): { label: MilestoneStatus; color: string; bg: string } {
  // These colors are resolved dynamically from arguments — placeholder; will be replaced at call site
  if (!m.deadline_months) return { label: 'No deadline', color: '#4A6278', bg: 'rgba(74,98,120,0.12)' };
  if (m.saved_amount >= m.target_amount) return { label: 'Completed', color: '#10B97A', bg: 'rgba(16,185,122,0.12)' };
  const required = (m.target_amount - m.saved_amount) / m.deadline_months;
  if (m.monthly_saving >= required) return { label: 'Ahead', color: '#C9943F', bg: 'rgba(201,148,63,0.12)' };
  if (m.monthly_saving >= required * 0.8) return { label: 'On Track', color: '#10B97A', bg: 'rgba(16,185,122,0.12)' };
  return { label: 'At Risk', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
}

function monthsToReach(target: number, saved: number, monthly: number): number | null {
  if (monthly <= 0) return null;
  const needed = target - saved;
  if (needed <= 0) return 0;
  return Math.ceil(needed / monthly);
}

// ─── Shared input/label styles factory ───────────────────────────────────────

function sharedInputStyle(colors: any) {
  return {
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
}

function sharedLabelStyle(colors: any) {
  return {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
    marginTop: 14,
  };
}

// ─── AddMilestoneSheet ────────────────────────────────────────────────────────

interface AddMilestoneSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    icon: string;
    target_amount: number;
    saved_amount: number;
    monthly_saving: number;
    deadline_months: number | null;
  }) => Promise<void>;
  colors: any;
  isDark: boolean;
  currency: string;
  /** If set, the sheet is in edit mode */
  editMilestone?: Milestone | null;
}

function AddMilestoneSheet({
  visible, onClose, onAdd, colors, isDark, currency, editMilestone,
}: AddMilestoneSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>(MILESTONE_ICONS[0].icon);
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [monthly, setMonthly] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editMilestone) {
        setName(editMilestone.name);
        setSelectedIcon(editMilestone.icon);
        setTarget(editMilestone.target_amount.toString());
        setSaved(editMilestone.saved_amount.toString());
        setMonthly(editMilestone.monthly_saving.toString());
        setDeadline(editMilestone.deadline_months?.toString() ?? '');
      } else {
        setName(''); setSelectedIcon(MILESTONE_ICONS[0].icon);
        setTarget(''); setSaved(''); setMonthly(''); setDeadline('');
      }
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, editMilestone]);

  const targetNum = parseFloat(target.replace(/,/g, '')) || 0;
  const savedNum = parseFloat(saved.replace(/,/g, '')) || 0;
  const monthlyNum = parseFloat(monthly.replace(/,/g, '')) || 0;
  const deadlineNum = parseInt(deadline) || null;
  const monthsPreview = targetNum > 0 && monthlyNum > 0
    ? monthsToReach(targetNum, savedNum, monthlyNum) : null;

  async function handleSubmit() {
    if (!name.trim()) { Alert.alert('Name required', 'Enter a name for this goal.'); return; }
    if (!targetNum || targetNum <= 0) { Alert.alert('Target required', 'Enter a target amount.'); return; }
    setSubmitting(true);
    await onAdd({
      name: name.trim(),
      icon: selectedIcon,
      target_amount: targetNum,
      saved_amount: savedNum,
      monthly_saving: monthlyNum,
      deadline_months: deadlineNum,
    });
    setSubmitting(false);
  }

  const inputStyle = sharedInputStyle(colors);
  const labelStyle = sharedLabelStyle(colors);
  const iconObj = MILESTONE_ICONS.find(i => i.icon === selectedIcon) ?? MILESTONE_ICONS[0];

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
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 4, marginTop: 8 }}>
          {editMilestone ? 'Edit Goal' : 'Add Life Goal'}
        </Text>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 4, lineHeight: 20 }}>
          Plan ahead for the things that matter most.
        </Text>

        <Text style={labelStyle}>GOAL NAME</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="e.g. Buy a car"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={40}
          returnKeyType="next"
        />

        <Text style={labelStyle}>ICON</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
            {MILESTONE_ICONS.map((item) => {
              const active = selectedIcon === item.icon;
              return (
                <TouchableOpacity
                  key={item.icon}
                  onPress={() => setSelectedIcon(item.icon)}
                  style={{
                    width: 52, height: 52, borderRadius: 14,
                    backgroundColor: active ? item.color + '33' : colors.surface,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? item.color : colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name={item.icon as any} size={22} color={active ? item.color : colors.textMuted} />
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 9, color: active ? item.color : colors.textMuted, marginTop: 2 }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text style={labelStyle}>TARGET AMOUNT</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          returnKeyType="next"
        />

        <Text style={labelStyle}>ALREADY SAVED</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={saved}
          onChangeText={setSaved}
          keyboardType="decimal-pad"
          returnKeyType="next"
        />

        <Text style={labelStyle}>MONTHLY CONTRIBUTION</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={monthly}
          onChangeText={setMonthly}
          keyboardType="decimal-pad"
          returnKeyType="next"
        />

        <Text style={labelStyle}>DEADLINE (MONTHS) — OPTIONAL</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="e.g. 24"
          placeholderTextColor={colors.textMuted}
          value={deadline}
          onChangeText={setDeadline}
          keyboardType="number-pad"
          returnKeyType="done"
        />

        {monthsPreview !== null && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: colors.goldBg, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 10, marginTop: 14,
          }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: iconObj.color + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={selectedIcon as any} size={14} color={iconObj.color} />
            </View>
            <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: colors.gold, flex: 1 }}>
              {monthsPreview === 0
                ? "You've already reached this goal!"
                : `You'll reach this in ${monthsPreview} month${monthsPreview === 1 ? '' : 's'}`}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: colors.gold, borderRadius: 14,
            paddingVertical: 15, alignItems: 'center', marginTop: 24,
            opacity: submitting ? 0.7 : 1,
          }}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} size="small" />
            : <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: isDark ? colors.bg : '#FFF' }}>
                {editMilestone ? 'Save Changes' : 'Add Goal'}
              </Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 14 }} onPress={onClose}>
          <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── EditSavedSheet (quick update saved_amount on a milestone) ────────────────

interface EditSavedSheetProps {
  visible: boolean;
  milestone: Milestone | null;
  onClose: () => void;
  onSave: (id: string, newSaved: number) => Promise<void>;
  colors: any;
  isDark: boolean;
  currency: string;
}

function EditSavedSheet({ visible, milestone, onClose, onSave, colors, isDark, currency }: EditSavedSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && milestone) {
      setValue(milestone.saved_amount > 0 ? milestone.saved_amount.toString() : '');
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, milestone]);

  async function handleSave() {
    if (!milestone) return;
    const num = parseFloat(value.replace(/,/g, '')) || 0;
    setSubmitting(true);
    await onSave(milestone.id, num);
    setSubmitting(false);
  }

  const iconObj = milestone ? (MILESTONE_ICONS.find(i => i.icon === milestone.icon) ?? MILESTONE_ICONS[7]) : MILESTONE_ICONS[7];

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
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {milestone && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 20 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: iconObj.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={milestone.icon as any} size={22} color={iconObj.color} />
              </View>
              <View>
                <Text style={{ fontFamily: FONTS.heading, fontSize: 20, color: colors.textPrimary }}>{milestone.name}</Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary }}>
                  Update how much you've saved
                </Text>
              </View>
            </View>

            <Text style={sharedLabelStyle(colors)}>AMOUNT SAVED SO FAR</Text>
            <BottomSheetInput
              style={sharedInputStyle(colors)}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              returnKeyType="done"
              autoFocus
            />

            <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
              Target: {fmt(milestone.target_amount, currency as any)}
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: colors.gold, borderRadius: 14,
                paddingVertical: 15, alignItems: 'center', marginTop: 24,
                opacity: submitting ? 0.7 : 1,
              }}
              onPress={handleSave}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} size="small" />
                : <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: isDark ? colors.bg : '#FFF' }}>Update Saved Amount</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 14 }} onPress={onClose}>
              <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── AddFundSheet ──────────────────────────────────────────────────────────────

interface AddFundSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    icon: string;
    color: string;
    target_amount: number;
    monthly_target: number;
  }) => Promise<void>;
  colors: any;
  isDark: boolean;
  currency: string;
  editFund?: SinkingFund | null;
}

function AddFundSheet({ visible, onClose, onAdd, colors, isDark, currency, editFund }: AddFundSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('home-outline');
  const [selectedColor, setSelectedColor] = useState(SWATCH_COLORS[0]);
  const [target, setTarget] = useState('');
  const [monthly, setMonthly] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editFund) {
        setName(editFund.name);
        setSelectedIcon(editFund.icon);
        setSelectedColor(editFund.color);
        setTarget(editFund.target_amount.toString());
        setMonthly(editFund.monthly_target.toString());
      } else {
        setName(''); setSelectedIcon('home-outline');
        setSelectedColor(SWATCH_COLORS[0]); setTarget(''); setMonthly('');
      }
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, editFund]);

  const targetNum = parseFloat(target.replace(/,/g, '')) || 0;
  const monthlyNum = parseFloat(monthly.replace(/,/g, '')) || 0;
  const monthsPreview = targetNum > 0 && monthlyNum > 0
    ? monthsToReach(targetNum, 0, monthlyNum) : null;

  function applyTemplate(tpl: typeof FUND_TEMPLATES[number]) {
    setName(tpl.name);
    setSelectedIcon(tpl.icon);
    setSelectedColor(tpl.color);
  }

  async function handleSubmit() {
    if (!name.trim()) { Alert.alert('Name required', 'Enter a name for this fund.'); return; }
    if (!targetNum || targetNum <= 0) { Alert.alert('Target required', 'Enter a target amount.'); return; }
    setSubmitting(true);
    await onAdd({
      name: name.trim(),
      icon: selectedIcon,
      color: selectedColor,
      target_amount: targetNum,
      monthly_target: monthlyNum,
    });
    setSubmitting(false);
  }

  const inputStyle = sharedInputStyle(colors);
  const labelStyle = sharedLabelStyle(colors);
  const templateIcons = Array.from(new Set(FUND_TEMPLATES.map(t => t.icon)));

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
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.textPrimary, marginBottom: 4, marginTop: 8 }}>
          {editFund ? 'Edit Fund' : 'New Sinking Fund'}
        </Text>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary, marginBottom: 4, lineHeight: 20 }}>
          Set aside money each month for planned expenses.
        </Text>

        {/* Template chips */}
        {!editFund && (
          <>
            <Text style={labelStyle}>QUICK TEMPLATES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {FUND_TEMPLATES.map((tpl) => (
                  <TouchableOpacity
                    key={tpl.name}
                    onPress={() => applyTemplate(tpl)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: name === tpl.name ? tpl.color + '22' : colors.surface,
                      borderWidth: 1,
                      borderColor: name === tpl.name ? tpl.color : colors.border,
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={tpl.icon as any} size={14} color={name === tpl.name ? tpl.color : colors.textMuted} />
                    <Text style={{ fontFamily: FONTS.medium, fontSize: 12, color: name === tpl.name ? tpl.color : colors.textSecondary }}>
                      {tpl.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        <Text style={labelStyle}>FUND NAME</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="e.g. Annual Rent"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={40}
          returnKeyType="next"
        />

        <Text style={labelStyle}>ICON</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
            {FUND_TEMPLATES.map((tpl) => {
              const active = selectedIcon === tpl.icon;
              return (
                <TouchableOpacity
                  key={tpl.icon + tpl.name}
                  onPress={() => setSelectedIcon(tpl.icon)}
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: active ? selectedColor + '33' : colors.surface,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? selectedColor : colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name={tpl.icon as any} size={18} color={active ? selectedColor : colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text style={labelStyle}>COLOR</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 4 }}>
          {SWATCH_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setSelectedColor(c)}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: c,
                borderWidth: selectedColor === c ? 3 : 0,
                borderColor: colors.textPrimary,
              }}
              activeOpacity={0.8}
            />
          ))}
        </View>

        <Text style={labelStyle}>ANNUAL TARGET AMOUNT</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          returnKeyType="next"
        />

        <Text style={labelStyle}>MONTHLY CONTRIBUTION</Text>
        <BottomSheetInput
          style={inputStyle}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={monthly}
          onChangeText={setMonthly}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />

        {monthsPreview !== null && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: selectedColor + '18', borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 10, marginTop: 14,
          }}>
            <Ionicons name="time-outline" size={16} color={selectedColor} />
            <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: selectedColor, flex: 1 }}>
              {monthsPreview === 0
                ? "You've already reached this target!"
                : `You'll hit this target in ${monthsPreview} month${monthsPreview === 1 ? '' : 's'}`}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: colors.gold, borderRadius: 14,
            paddingVertical: 15, alignItems: 'center', marginTop: 24,
            opacity: submitting ? 0.7 : 1,
          }}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={isDark ? colors.bg : '#FFF'} size="small" />
            : <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: isDark ? colors.bg : '#FFF' }}>
                {editFund ? 'Save Changes' : 'Create Fund'}
              </Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 14 }} onPress={onClose}>
          <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── LogContributionSheet ─────────────────────────────────────────────────────

interface LogContributionSheetProps {
  visible: boolean;
  fund: SinkingFund | null;
  onClose: () => void;
  onLog: (id: string, amount: number) => Promise<void>;
  colors: any;
  isDark: boolean;
  currency: string;
}

function LogContributionSheet({ visible, fund, onClose, onLog, colors, isDark, currency }: LogContributionSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && fund) {
      setValue('');
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, fund]);

  async function handleLog() {
    if (!fund) return;
    const num = parseFloat(value.replace(/,/g, '')) || 0;
    if (num <= 0) { Alert.alert('Invalid amount', 'Enter an amount greater than 0.'); return; }
    setSubmitting(true);
    await onLog(fund.id, num);
    setSubmitting(false);
  }

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
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        {fund && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 20 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: fund.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={fund.icon as any} size={22} color={fund.color} />
              </View>
              <View>
                <Text style={{ fontFamily: FONTS.heading, fontSize: 20, color: colors.textPrimary }}>{fund.name}</Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary }}>
                  {fmt(fund.saved_amount, currency as any)} saved of {fmt(fund.target_amount, currency as any)}
                </Text>
              </View>
            </View>

            <Text style={sharedLabelStyle(colors)}>AMOUNT TO ADD</Text>
            <BottomSheetInput
              style={sharedInputStyle(colors)}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              returnKeyType="done"
              autoFocus
            />

            <TouchableOpacity
              style={{
                backgroundColor: fund.color, borderRadius: 14,
                paddingVertical: 15, alignItems: 'center', marginTop: 24,
                opacity: submitting ? 0.7 : 1,
              }}
              onPress={handleLog}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: '#FFF' }}>Add to Fund</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 14 }} onPress={onClose}>
              <Text style={{ fontFamily: FONTS.medium, fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── FeaturedMilestoneCard ────────────────────────────────────────────────────

function FeaturedMilestoneCard({
  milestone, colors, isDark, currency, onTap, onLongPress,
}: {
  milestone: Milestone;
  colors: any; isDark: boolean; currency: string;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const iconObj = MILESTONE_ICONS.find(i => i.icon === milestone.icon) ?? MILESTONE_ICONS[7];
  const status = getMilestoneStatus(milestone);
  const progress = milestone.target_amount > 0 ? Math.min(1, milestone.saved_amount / milestone.target_amount) : 0;

  return (
    <TouchableOpacity
      onPress={onTap} onLongPress={onLongPress} activeOpacity={0.9}
      style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 12 }}
    >
      <LinearGradient
        colors={isDark ? ['#2e1413', '#3f2221'] : ['#7a5a1a', '#9a7232']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ padding: 24 }}
      >
        {/* Pill + deadline */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <View style={{ backgroundColor: colors.goldBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: colors.gold, letterSpacing: 1.5, textTransform: 'uppercase' }}>Life Milestone</Text>
          </View>
          {milestone.deadline_months && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase' }}>In {milestone.deadline_months} months</Text>
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={{ fontFamily: FONTS.headingItalic, fontSize: 28, color: 'rgba(255,255,255,0.92)', marginBottom: 20, lineHeight: 32 }}>
          {milestone.name}
        </Text>

        {/* Amounts row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <View>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Target</Text>
            <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: 'rgba(255,255,255,0.9)' }}>{fmt(milestone.target_amount, currency as any)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Saved</Text>
            <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: colors.goldLight ?? colors.gold }}>{fmt(milestone.saved_amount, currency as any)}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
          <View style={{ height: 4, width: `${Math.round(progress * 100)}%`, backgroundColor: colors.gold, borderRadius: 2 }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 }}>{Math.round(progress * 100)}% Progress</Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 }}>{fmt(Math.max(0, milestone.target_amount - milestone.saved_amount), currency as any)} Remaining</Text>
        </View>

        {/* Divider + footer row */}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 20, marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 32 }}>
          <View>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly</Text>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{fmt(milestone.monthly_saving, currency as any)}</Text>
          </View>
          <View>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</Text>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, marginTop: 2, color: status.color }}>{status.label}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── MilestoneCard ────────────────────────────────────────────────────────────

function MilestoneCard({
  milestone, colors, isDark, currency, onTap, onLongPress,
}: {
  milestone: Milestone;
  colors: any; isDark: boolean; currency: string;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const iconObj = MILESTONE_ICONS.find(i => i.icon === milestone.icon) ?? MILESTONE_ICONS[7];
  const status = getMilestoneStatus(milestone);
  const progress = milestone.target_amount > 0
    ? Math.min(1, milestone.saved_amount / milestone.target_amount) : 0;
  const required = milestone.deadline_months
    ? (milestone.target_amount - milestone.saved_amount) / milestone.deadline_months : 0;

  const cardStyle = {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.06,
    shadowRadius: 4,
    elevation: isDark ? 0 : 2,
    marginBottom: 10,
  };

  return (
    <TouchableOpacity style={cardStyle} onPress={onTap} onLongPress={onLongPress} activeOpacity={0.85}>
      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: iconObj.color + '22',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Ionicons name={milestone.icon as any} size={22} color={iconObj.color} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: FONTS.headingItalic, fontSize: 15, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
              {milestone.name}
            </Text>
            <View style={{ backgroundColor: status.bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8, flexShrink: 0 }}>
              <Text style={{ fontFamily: FONTS.semibold, fontSize: 11, color: status.color }}>{status.label}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            Target: {fmt(milestone.target_amount, currency as any)}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ marginTop: 14 }}>
        <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
          <View style={{
            height: 6, borderRadius: 3,
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: iconObj.color,
          }} />
        </View>
        <Text style={{ fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
          {Math.round(progress * 100)}% funded
        </Text>
      </View>

      {/* Bottom stats row */}
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 0 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saved</Text>
          <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary, marginTop: 2 }}>
            {fmt(milestone.saved_amount, currency as any)}
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly</Text>
          <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary, marginTop: 2 }}>
            {fmt(milestone.monthly_saving, currency as any)}
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {milestone.deadline_months ? 'Months left' : 'No deadline'}
          </Text>
          <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary, marginTop: 2 }}>
            {milestone.deadline_months ? `${milestone.deadline_months}` : '—'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── FundCard ─────────────────────────────────────────────────────────────────

function FundCard({
  fund, colors, isDark, currency, onAdd, onLongPress,
}: {
  fund: SinkingFund;
  colors: any; isDark: boolean; currency: string;
  onAdd: () => void;
  onLongPress: () => void;
}) {
  const progress = fund.target_amount > 0
    ? Math.min(1, fund.saved_amount / fund.target_amount) : 0;

  const cardStyle = {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.06,
    shadowRadius: 4,
    elevation: isDark ? 0 : 2,
    marginBottom: 10,
  };

  return (
    <TouchableOpacity style={cardStyle} onLongPress={onLongPress} activeOpacity={0.9}>
      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: fund.color + '22',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Ionicons name={fund.icon as any} size={20} color={fund.color} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: FONTS.headingItalic, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>
            {fund.name}
          </Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
            {fmt(fund.saved_amount, currency as any)} saved of {fmt(fund.target_amount, currency as any)}
          </Text>
        </View>

        {/* Monthly chip */}
        <View style={{ backgroundColor: fund.color + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 }}>
          <Text style={{ fontFamily: FONTS.semibold, fontSize: 11, color: fund.color }}>
            {fmt(fund.monthly_target, currency as any)}/mo
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ marginTop: 12 }}>
        <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
          <View style={{
            height: 6, borderRadius: 3,
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: fund.color,
          }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
          <Text style={{ fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted }}>
            {Math.round(progress * 100)}% funded
          </Text>
          <TouchableOpacity
            onPress={onAdd}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: fund.color + '18', borderRadius: 6,
              paddingHorizontal: 8, paddingVertical: 3,
            }}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={13} color={fund.color} />
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: fund.color }}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const { colors, isDark } = useTheme();
  const { user, household, currency } = useAuth();

  const [segment, setSegment] = useState<'milestones' | 'funds'>('milestones');

  // Milestones state
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [milestonesRefreshing, setMilestonesRefreshing] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editSavedMilestone, setEditSavedMilestone] = useState<Milestone | null>(null);
  const [showEditSaved, setShowEditSaved] = useState(false);

  // Sinking funds state
  const [funds, setFunds] = useState<SinkingFund[]>([]);
  const [fundsLoading, setFundsLoading] = useState(true);
  const [fundsRefreshing, setFundsRefreshing] = useState(false);
  const [showAddFund, setShowAddFund] = useState(false);
  const [editingFund, setEditingFund] = useState<SinkingFund | null>(null);
  const [logFund, setLogFund] = useState<SinkingFund | null>(null);
  const [showLog, setShowLog] = useState(false);

  // ── Load milestones ─────────────────────────────────────────────────────────

  const loadMilestones = useCallback(async () => {
    if (!user) return;
    let q = (supabase as any).from('milestones').select('*').order('created_at', { ascending: false });
    q = household
      ? q.eq('household_id', household.id)
      : q.eq('user_id', user.id).is('household_id', null);
    const { data, error } = await q;
    if (!error && data) setMilestones(data as Milestone[]);
  }, [user, household]);

  useEffect(() => {
    setMilestonesLoading(true);
    loadMilestones().finally(() => setMilestonesLoading(false));
  }, [loadMilestones]);

  const refreshMilestones = useCallback(async () => {
    setMilestonesRefreshing(true);
    await loadMilestones();
    setMilestonesRefreshing(false);
  }, [loadMilestones]);

  // ── Load funds ──────────────────────────────────────────────────────────────

  const loadFunds = useCallback(async () => {
    if (!user) return;
    let q = (supabase as any).from('sinking_funds').select('*').order('created_at', { ascending: false });
    q = household
      ? q.eq('household_id', household.id)
      : q.eq('user_id', user.id).is('household_id', null);
    const { data, error } = await q;
    if (!error && data) setFunds(data as SinkingFund[]);
  }, [user, household]);

  useEffect(() => {
    setFundsLoading(true);
    loadFunds().finally(() => setFundsLoading(false));
  }, [loadFunds]);

  const refreshFunds = useCallback(async () => {
    setFundsRefreshing(true);
    await loadFunds();
    setFundsRefreshing(false);
  }, [loadFunds]);

  // ── Milestone CRUD ──────────────────────────────────────────────────────────

  async function handleAddMilestone(data: {
    name: string; icon: string; target_amount: number;
    saved_amount: number; monthly_saving: number; deadline_months: number | null;
  }) {
    if (!user) return;
    if (editingMilestone) {
      // Update
      const { error } = await (supabase as any).from('milestones')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editingMilestone.id);
      if (error) { Alert.alert('Error', error.message); return; }
    } else {
      // Insert
      const { error } = await (supabase as any).from('milestones').insert({
        ...data,
        user_id: user.id,
        household_id: household?.id ?? null,
      });
      if (error) { Alert.alert('Error', error.message); return; }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddMilestone(false);
    setEditingMilestone(null);
    await loadMilestones();
  }

  async function handleUpdateSaved(id: string, newSaved: number) {
    const { error } = await (supabase as any).from('milestones')
      .update({ saved_amount: newSaved })
      .eq('id', id);
    if (error) { Alert.alert('Error', error.message); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditSaved(false);
    setEditSavedMilestone(null);
    await loadMilestones();
  }

  function handleMilestoneLongPress(milestone: Milestone) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(milestone.name, 'What would you like to do?', [
      {
        text: 'Edit Goal',
        onPress: () => { setEditingMilestone(milestone); setShowAddMilestone(true); },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete goal', `Remove "${milestone.name}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive',
              onPress: async () => {
                const { error } = await (supabase as any).from('milestones').delete().eq('id', milestone.id);
                if (error) Alert.alert('Error', error.message);
                else await loadMilestones();
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // ── Fund CRUD ───────────────────────────────────────────────────────────────

  async function handleAddFund(data: {
    name: string; icon: string; color: string;
    target_amount: number; monthly_target: number;
  }) {
    if (!user) return;
    if (editingFund) {
      const { error } = await (supabase as any).from('sinking_funds')
        .update({ ...data })
        .eq('id', editingFund.id);
      if (error) { Alert.alert('Error', error.message); return; }
    } else {
      const { error } = await (supabase as any).from('sinking_funds').insert({
        ...data,
        user_id: user.id,
        household_id: household?.id ?? null,
        saved_amount: 0,
      });
      if (error) { Alert.alert('Error', error.message); return; }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddFund(false);
    setEditingFund(null);
    await loadFunds();
  }

  async function handleLogContribution(id: string, amount: number) {
    const fund = funds.find(f => f.id === id);
    if (!fund) return;
    const newSaved = fund.saved_amount + amount;
    const { error } = await (supabase as any).from('sinking_funds')
      .update({ saved_amount: newSaved })
      .eq('id', id);
    if (error) { Alert.alert('Error', error.message); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowLog(false);
    setLogFund(null);
    await loadFunds();
  }

  function handleFundLongPress(fund: SinkingFund) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(fund.name, 'What would you like to do?', [
      {
        text: 'Edit Fund',
        onPress: () => { setEditingFund(fund); setShowAddFund(true); },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete fund', `Remove "${fund.name}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive',
              onPress: async () => {
                const { error } = await (supabase as any).from('sinking_funds').delete().eq('id', fund.id);
                if (error) Alert.alert('Error', error.message);
                else await loadFunds();
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function quickAddTemplate(tpl: typeof FUND_TEMPLATES[number]) {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await (supabase as any).from('sinking_funds').insert({
      name: tpl.name,
      icon: tpl.icon,
      color: tpl.color,
      target_amount: 0,
      saved_amount: 0,
      monthly_target: 0,
      user_id: user.id,
      household_id: household?.id ?? null,
    });
    if (error) { Alert.alert('Error', error.message); return; }
    await loadFunds();
  }

  const s = makeStyles(colors, isDark);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Hero header */}
      <View style={s.heroHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroEyebrow}>WEALTH STEWARDSHIP</Text>
          <Text style={s.heroTitle}>Plan your <Text style={s.heroTitleItalic}>legacy.</Text></Text>
          <Text style={s.heroSubtitle}>Strategize for milestones that define your journey.</Text>
        </View>
        <TouchableOpacity
          style={s.heroAddBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (segment === 'milestones') {
              setEditingMilestone(null);
              setShowAddMilestone(true);
            } else {
              setEditingFund(null);
              setShowAddFund(true);
            }
          }}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#e9c349', '#aa890a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroAddGrad}>
            <Ionicons name="add" size={16} color="#3c2f00" />
            <Text style={s.heroAddTxt}>NEW GOAL</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Underline tab control */}
      <View style={s.tabRow}>
        {(['milestones', 'funds'] as const).map((seg) => {
          const active = segment === seg;
          return (
            <TouchableOpacity
              key={seg}
              style={s.tabBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSegment(seg);
              }}
            >
              <Text style={[s.tabTxt, active && s.tabTxtActive]}>
                {seg === 'milestones' ? 'Milestones' : 'Sinking Funds'}
              </Text>
              {active && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── MILESTONES SEGMENT ───────────────────────────────────────────────── */}
      {segment === 'milestones' && (
        milestonesLoading ? (
          <View style={s.loaderWrap}>
            <ActivityIndicator color={colors.gold} size="large" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={milestonesRefreshing}
                onRefresh={refreshMilestones}
                tintColor={colors.gold}
                colors={[colors.gold]}
              />
            }
          >
            {milestones.length === 0 ? (
              <View style={s.emptyWrap}>
                <View style={[s.emptyIconCircle, { backgroundColor: colors.goldBg }]}>
                  <Ionicons name="flag-outline" size={40} color={colors.gold} />
                </View>
                <Text style={s.emptyTitleItalic}>Set your first goal.</Text>
                <Text style={s.emptySub}>Plan for a car, a home, or anything that matters.</Text>
                <TouchableOpacity
                  style={s.emptyBtnWrap}
                  onPress={() => { setEditingMilestone(null); setShowAddMilestone(true); }}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#e9c349', '#aa890a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyBtn}>
                    <Ionicons name="add" size={16} color="#3c2f00" />
                    <Text style={s.emptyBtnText}>Add Life Goal</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.listSection}>
                <Text style={s.sectionLabel}>{milestones.length} goal{milestones.length !== 1 ? 's' : ''}</Text>
                {milestones.map((m, index) => index === 0 ? (
                  <FeaturedMilestoneCard
                    key={m.id}
                    milestone={m}
                    colors={colors}
                    isDark={isDark}
                    currency={currency}
                    onTap={() => { setEditSavedMilestone(m); setShowEditSaved(true); }}
                    onLongPress={() => handleMilestoneLongPress(m)}
                  />
                ) : (
                  <MilestoneCard
                    key={m.id}
                    milestone={m}
                    colors={colors}
                    isDark={isDark}
                    currency={currency}
                    onTap={() => { setEditSavedMilestone(m); setShowEditSaved(true); }}
                    onLongPress={() => handleMilestoneLongPress(m)}
                  />
                ))}
                {/* Tap-to-add card */}
                <TouchableOpacity
                  style={s.addDashedCard}
                  onPress={() => { setEditingMilestone(null); setShowAddMilestone(true); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.gold} />
                  <Text style={s.addDashedText}>Add another goal</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )
      )}

      {/* ── SINKING FUNDS SEGMENT ────────────────────────────────────────────── */}
      {segment === 'funds' && (
        fundsLoading ? (
          <View style={s.loaderWrap}>
            <ActivityIndicator color={colors.gold} size="large" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={fundsRefreshing}
                onRefresh={refreshFunds}
                tintColor={colors.gold}
                colors={[colors.gold]}
              />
            }
          >
            {funds.length === 0 ? (
              <View style={s.listSection}>
                <View style={s.emptyWrap}>
                  <View style={[s.emptyIconCircle, { backgroundColor: colors.goldBg }]}>
                    <Ionicons name="wallet-outline" size={40} color={colors.gold} />
                  </View>
                  <Text style={s.emptyTitle}>No sinking funds yet</Text>
                  <Text style={s.emptySub}>Set money aside each month for big planned expenses.</Text>
                </View>

                {/* Template grid */}
                <Text style={[s.sectionLabel, { marginTop: 8 }]}>Quick-add a template</Text>
                <View style={s.templateGrid}>
                  {FUND_TEMPLATES.map((tpl) => (
                    <TouchableOpacity
                      key={tpl.name}
                      style={[s.templateChip, { borderColor: tpl.color + '55' }]}
                      onPress={() => quickAddTemplate(tpl)}
                      activeOpacity={0.75}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: tpl.color + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                        <Ionicons name={tpl.icon as any} size={14} color={tpl.color} />
                      </View>
                      <Text style={{ fontFamily: FONTS.medium, fontSize: 12, color: colors.textSecondary, textAlign: 'center' }} numberOfLines={2}>
                        {tpl.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={s.listSection}>
                <Text style={s.sectionLabel}>{funds.length} fund{funds.length !== 1 ? 's' : ''}</Text>
                {funds.map((f) => (
                  <FundCard
                    key={f.id}
                    fund={f}
                    colors={colors}
                    isDark={isDark}
                    currency={currency}
                    onAdd={() => { setLogFund(f); setShowLog(true); }}
                    onLongPress={() => handleFundLongPress(f)}
                  />
                ))}
                <TouchableOpacity
                  style={s.addDashedCard}
                  onPress={() => { setEditingFund(null); setShowAddFund(true); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.gold} />
                  <Text style={s.addDashedText}>Add another fund</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )
      )}

      {/* ── Bottom Sheets ──────────────────────────────────────────────────────── */}

      <AddMilestoneSheet
        visible={showAddMilestone}
        onClose={() => { setShowAddMilestone(false); setEditingMilestone(null); }}
        onAdd={handleAddMilestone}
        colors={colors}
        isDark={isDark}
        currency={currency}
        editMilestone={editingMilestone}
      />

      <EditSavedSheet
        visible={showEditSaved}
        milestone={editSavedMilestone}
        onClose={() => { setShowEditSaved(false); setEditSavedMilestone(null); }}
        onSave={handleUpdateSaved}
        colors={colors}
        isDark={isDark}
        currency={currency}
      />

      <AddFundSheet
        visible={showAddFund}
        onClose={() => { setShowAddFund(false); setEditingFund(null); }}
        onAdd={handleAddFund}
        colors={colors}
        isDark={isDark}
        currency={currency}
        editFund={editingFund}
      />

      <LogContributionSheet
        visible={showLog}
        fund={logFund}
        onClose={() => { setShowLog(false); setLogFund(null); }}
        onLog={handleLogContribution}
        colors={colors}
        isDark={isDark}
        currency={currency}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // Hero header
    heroHeader: {
      paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    },
    heroEyebrow: {
      fontFamily: FONTS.semibold, fontSize: 10, color: colors.gold,
      letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8,
    },
    heroTitle: {
      fontFamily: FONTS.heading, fontSize: 40, color: colors.textPrimary,
      letterSpacing: -1, lineHeight: 44, marginBottom: 8,
    },
    heroTitleItalic: {
      fontFamily: FONTS.headingItalic, fontSize: 40, color: colors.textPrimary, letterSpacing: -1,
    },
    heroSubtitle: {
      fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, lineHeight: 20,
    },
    heroAddBtn: { marginTop: 8, flexShrink: 0 },
    heroAddGrad: {
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
      flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    heroAddTxt: { fontFamily: FONTS.semibold, fontSize: 11, color: '#271900', letterSpacing: 1.5 },

    // Underline tab control
    tabRow: {
      flexDirection: 'row', paddingHorizontal: 20, gap: 28,
      borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4,
    },
    tabBtn: { paddingBottom: 12, position: 'relative' },
    tabTxt: { fontFamily: FONTS.heading, fontSize: 18, color: colors.textMuted, opacity: 0.45 },
    tabTxtActive: { color: colors.textPrimary, opacity: 1 },
    tabUnderline: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 2, backgroundColor: colors.gold, borderRadius: 1,
    },

    scrollContent: { paddingBottom: 48 },

    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    listSection: { paddingHorizontal: 20, paddingTop: 4 },
    sectionLabel: {
      fontFamily: FONTS.semibold, fontSize: 11, color: colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
    },

    // Empty state
    emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
    emptyIconCircle: {
      width: 80, height: 80, borderRadius: 40,
      alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    emptyTitle: { fontFamily: FONTS.heading, fontSize: 20, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    emptyTitleItalic: { fontFamily: FONTS.headingItalic, fontSize: 28, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    emptySub: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
    emptyBtnWrap: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
    },
    emptyBtnText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#271900' },

    // Template grid (2 columns)
    templateGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    },
    templateChip: {
      width: '47%',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 3,
      elevation: isDark ? 0 : 1,
    },

    // Dashed add card
    addDashedCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginTop: 4, borderRadius: 16,
      borderWidth: 1.5, borderColor: colors.gold + '55',
      borderStyle: 'dashed', padding: 18, justifyContent: 'center',
    },
    addDashedText: { fontFamily: FONTS.medium, fontSize: 14, color: colors.gold },
  });
}
