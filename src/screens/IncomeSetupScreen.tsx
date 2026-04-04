import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, BUCKET_COLORS } from '@/constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount: number) => '₦' + amount.toLocaleString('en-NG');

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMonth(): string {
  return new Date().toLocaleString('en-NG', { month: 'long', year: 'numeric' });
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TOTAL_INCOME = 450000;

const INCOME_SOURCES = [
  {
    id: '1',
    name: 'GTBank Salary',
    subtitle: 'Fixed monthly income',
    type: 'SALARY',
    amount: 350000,
    icon: 'briefcase-outline' as const,
    accentColor: COLORS.emerald,
    accentBg: COLORS.emeraldBg,
  },
  {
    id: '2',
    name: 'Freelance Design',
    subtitle: 'Variable income',
    type: 'FREELANCE',
    amount: 100000,
    icon: 'laptop-outline' as const,
    accentColor: COLORS.gold,
    accentBg: COLORS.goldBg,
  },
];

const ALLOCATION_SNAPSHOT = [
  { pct: 29, color: BUCKET_COLORS[0] },
  { pct: 10, color: BUCKET_COLORS[1] },
  { pct: 22, color: BUCKET_COLORS[2] },
  { pct: 10, color: BUCKET_COLORS[3] },
  { pct: 5,  color: BUCKET_COLORS[4] },
  { pct: 15, color: BUCKET_COLORS[5] },
  { pct: 9,  color: BUCKET_COLORS[6] },
];

const MILESTONES = [
  {
    id: '1',
    name: 'Own a House',
    icon: 'home-outline' as const,
    accentColor: COLORS.gold,
    accentBg: COLORS.goldBg,
    pct: 38,
    months: 18,
    status: 'ON TRACK',
    statusColor: COLORS.emerald,
  },
  {
    id: '2',
    name: 'Buy a Car',
    icon: 'car-outline' as const,
    accentColor: COLORS.info,
    accentBg: COLORS.infoBg,
    pct: 72,
    months: 8,
    status: 'AHEAD',
    statusColor: COLORS.info,
  },
];

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  SALARY:      { bg: COLORS.emeraldBg,  text: COLORS.emerald },
  FREELANCE:   { bg: COLORS.goldBg,     text: COLORS.goldLight },
  BUSINESS:    { bg: COLORS.infoBg,     text: COLORS.info },
  GIFT:        { bg: COLORS.purpleBg,   text: COLORS.purple },
  'SIDE INCOME': { bg: COLORS.warningBg, text: COLORS.warning },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_BADGE[type] ?? TYPE_BADGE.SALARY;
  return (
    <View style={[styles.typeBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.typeBadgeText, { color: s.text }]}>{type}</Text>
    </View>
  );
}

function StackedBar() {
  return (
    <View style={styles.stackedBar}>
      {ALLOCATION_SNAPSHOT.map((seg, i) => (
        <View
          key={i}
          style={[
            styles.stackedSegment,
            { flex: seg.pct, backgroundColor: seg.color },
            i > 0 && { marginLeft: 2 },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function IncomeSetupScreen() {
  const allocated = TOTAL_INCOME;
  const remaining = 0;
  const isFullyAllocated = remaining === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── App Header ─────────────────────────────────── */}
        <View style={styles.appHeader}>
          <Text style={styles.wordmark}>Steward</Text>
          <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.8}>
            <Text style={styles.avatarLetter}>A</Text>
          </TouchableOpacity>
        </View>

        {/* ── Greeting ───────────────────────────────────── */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{getGreeting()}, Andrew</Text>
          <Text style={styles.subGreeting}>{getMonth()} · Income Overview</Text>
        </View>

        {/* ── Hero Income Card ───────────────────────────── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>TOTAL MONTHLY INCOME</Text>
          <Text style={styles.heroAmount}>{fmt(TOTAL_INCOME)}</Text>

          <StackedBar />

          <View style={styles.stackedLegend}>
            <Text style={styles.legendText}>Rent</Text>
            <Text style={styles.legendText}>Food</Text>
            <Text style={styles.legendText}>Savings</Text>
            <Text style={styles.legendText}>Invest</Text>
            <Text style={styles.legendText}>Fun</Text>
            <Text style={styles.legendText}>Emergency</Text>
            <Text style={styles.legendText}>Giving</Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{fmt(allocated)}</Text>
              <Text style={styles.statLabel}>Allocated</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[
                styles.statValue,
                { color: isFullyAllocated ? COLORS.emerald : COLORS.warning },
              ]}>
                {fmt(remaining)}
              </Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{INCOME_SOURCES.length}</Text>
              <Text style={styles.statLabel}>Sources</Text>
            </View>
          </View>

          {/* Fully allocated badge */}
          {isFullyAllocated && (
            <View style={styles.allocBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.emerald} />
              <Text style={styles.allocBadgeText}>
                100% allocated · Every naira has a purpose
              </Text>
            </View>
          )}
        </View>

        {/* ── Income Sources ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Income Sources</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>Edit</Text>
            </TouchableOpacity>
          </View>

          {INCOME_SOURCES.map((src, i) => (
            <TouchableOpacity
              key={src.id}
              style={[styles.sourceCard, i > 0 && styles.mt10]}
              activeOpacity={0.75}
            >
              <View style={[styles.sourceIconWrap, { backgroundColor: src.accentBg }]}>
                <Ionicons name={src.icon} size={20} color={src.accentColor} />
              </View>
              <View style={styles.sourceInfo}>
                <View style={styles.sourceNameRow}>
                  <Text style={styles.sourceName}>{src.name}</Text>
                  <TypeBadge type={src.type} />
                </View>
                <Text style={styles.sourceSubtitle}>{src.subtitle}</Text>
              </View>
              <View style={styles.sourceRight}>
                <Text style={styles.sourceAmount}>{fmt(src.amount)}</Text>
                <Text style={styles.sourceFreq}>/ month</Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.addSourceBtn} activeOpacity={0.75}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.gold} />
            <Text style={styles.addSourceText}>Add Income Source</Text>
          </TouchableOpacity>
        </View>

        {/* ── Active Milestones ──────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Milestones</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>View all</Text>
            </TouchableOpacity>
          </View>

          {MILESTONES.map((m, i) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.milestoneCard, i > 0 && styles.mt10]}
              activeOpacity={0.75}
            >
              <View style={styles.milestoneLeft}>
                <View style={[styles.milestoneIconWrap, { backgroundColor: m.accentBg }]}>
                  <Ionicons name={m.icon} size={20} color={m.accentColor} />
                </View>
                <View>
                  <Text style={styles.milestoneName}>{m.name}</Text>
                  <Text style={styles.milestoneTime}>{m.months} months remaining</Text>
                </View>
              </View>
              <View style={styles.milestoneRight}>
                <Text style={[styles.milestoneStatus, { color: m.statusColor }]}>
                  {m.status}
                </Text>
                <View style={styles.milestoneBar}>
                  <View
                    style={[
                      styles.milestoneBarFill,
                      { width: `${m.pct}%` as any, backgroundColor: m.accentColor },
                    ]}
                  />
                </View>
                <Text style={styles.milestonePct}>{m.pct}%</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // App header
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  wordmark: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.gold,
    letterSpacing: 0.4,
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.goldBg,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: COLORS.gold,
  },

  // Greeting
  greetingBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
  },
  greeting: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subGreeting: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // Hero card
  heroCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 28,
  },
  heroLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroAmount: {
    fontFamily: FONTS.display,
    fontSize: 48,
    color: COLORS.gold,
    letterSpacing: -1.5,
    marginBottom: 18,
  },

  // Stacked bar
  stackedBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
  },
  stackedSegment: {
    height: 10,
    borderRadius: 2,
  },
  stackedLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  legendText: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: COLORS.textMuted,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    marginTop: 2,
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  statLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },

  // Allocation badge
  allocBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.successBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  allocBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.success,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  sectionAction: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.gold,
  },
  mt10: {
    marginTop: 10,
  },

  // Source cards
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  sourceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sourceName: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  sourceSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  sourceRight: {
    alignItems: 'flex-end',
  },
  sourceAmount: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  sourceFreq: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    letterSpacing: 0.4,
  },

  // Add source button
  addSourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    borderStyle: 'dashed',
    backgroundColor: COLORS.goldBg,
  },
  addSourceText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.gold,
  },

  // Milestone cards
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  milestoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  milestoneIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneName: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  milestoneTime: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  milestoneRight: {
    alignItems: 'flex-end',
    gap: 5,
    minWidth: 84,
  },
  milestoneStatus: {
    fontFamily: FONTS.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  milestoneBar: {
    width: 84,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  milestoneBarFill: {
    height: 4,
    borderRadius: 2,
  },
  milestonePct: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
