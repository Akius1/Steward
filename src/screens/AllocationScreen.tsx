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

type ThresholdStatus = 'success' | 'warning' | 'danger' | null;

interface Threshold {
  status: ThresholdStatus;
  message: string;
}

interface Bucket {
  id: string;
  name: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  amount: number;
  pct: number;
  threshold: Threshold | null;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TOTAL = 450000;

const BUCKETS: Bucket[] = [
  {
    id: '1',
    name: 'Rent & Housing',
    icon: 'home-outline',
    color: BUCKET_COLORS[0],
    amount: 130500,
    pct: 29,
    threshold: {
      status: 'warning',
      message: 'Near ceiling · Safe threshold is 28–30%',
    },
  },
  {
    id: '2',
    name: 'Food & Groceries',
    icon: 'restaurant-outline',
    color: BUCKET_COLORS[1],
    amount: 45000,
    pct: 10,
    threshold: {
      status: 'warning',
      message: 'At limit · Target 8–10% of income',
    },
  },
  {
    id: '3',
    name: 'Savings',
    icon: 'business-outline',
    color: BUCKET_COLORS[2],
    amount: 99000,
    pct: 22,
    threshold: {
      status: 'success',
      message: 'Excellent · Above 20% minimum target',
    },
  },
  {
    id: '4',
    name: 'Investments',
    icon: 'trending-up-outline',
    color: BUCKET_COLORS[3],
    amount: 45000,
    pct: 10,
    threshold: null,
  },
  {
    id: '5',
    name: 'Entertainment',
    icon: 'musical-notes-outline',
    color: BUCKET_COLORS[4],
    amount: 22500,
    pct: 5,
    threshold: null,
  },
  {
    id: '6',
    name: 'Emergency Fund',
    icon: 'shield-checkmark-outline',
    color: BUCKET_COLORS[5],
    amount: 67500,
    pct: 15,
    threshold: {
      status: 'warning',
      message: 'Building · Fund covers 1.4 months (target: 3)',
    },
  },
  {
    id: '7',
    name: 'Giving',
    icon: 'heart-outline',
    color: BUCKET_COLORS[6],
    amount: 40500,
    pct: 9,
    threshold: null,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StackedBar() {
  return (
    <View style={styles.stackedBar}>
      {BUCKETS.map((b, i) => (
        <View
          key={b.id}
          style={[
            styles.stackedSegment,
            { flex: b.pct, backgroundColor: b.color },
            i > 0 && { marginLeft: 2 },
          ]}
        />
      ))}
    </View>
  );
}

function ThresholdBadge({ threshold }: { threshold: Threshold }) {
  const map = {
    success: { bg: COLORS.successBg,  text: COLORS.success, icon: 'checkmark-circle-outline' as const },
    warning: { bg: COLORS.warningBg,  text: COLORS.warning, icon: 'warning-outline' as const },
    danger:  { bg: COLORS.dangerBg,   text: COLORS.danger,  icon: 'close-circle-outline' as const },
  };
  const s = threshold.status ? map[threshold.status] : null;
  if (!s) return null;

  return (
    <View style={[styles.thresholdBadge, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={12} color={s.text} />
      <Text style={[styles.thresholdText, { color: s.text }]}>
        {threshold.message}
      </Text>
    </View>
  );
}

function BucketCard({ bucket }: { bucket: Bucket }) {
  return (
    <View style={styles.bucketCard}>
      {/* Top row: icon + name + amount */}
      <View style={styles.bucketTop}>
        <View style={[styles.bucketIconWrap, { backgroundColor: bucket.color + '22' }]}>
          <Ionicons name={bucket.icon} size={20} color={bucket.color} />
        </View>
        <Text style={styles.bucketName}>{bucket.name}</Text>
        <View style={styles.bucketAmountBlock}>
          <Text style={styles.bucketAmount}>{fmt(bucket.amount)}</Text>
          <Text style={styles.bucketPct}>{bucket.pct}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${bucket.pct}%` as any, backgroundColor: bucket.color },
          ]}
        />
      </View>

      {/* Threshold */}
      {bucket.threshold && (
        <ThresholdBadge threshold={bucket.threshold} />
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AllocationScreen() {
  const remaining = 0;
  const allocatedPct = 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      {/* ── Fixed Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Allocation</Text>
          <Text style={styles.headerSub}>April 2026</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Summary Card ────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>TOTAL TO ALLOCATE</Text>
              <Text style={styles.summaryTotal}>{fmt(TOTAL)}</Text>
            </View>
            <View style={styles.remainingPill}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.emerald} />
              <Text style={styles.remainingText}>₦0 remaining</Text>
            </View>
          </View>

          <StackedBar />

          {/* Bucket legend dots */}
          <View style={styles.legendRow}>
            {BUCKETS.map((b) => (
              <View key={b.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: b.color }]} />
                <Text style={styles.legendLabel}>{b.pct}%</Text>
              </View>
            ))}
          </View>

          {/* Allocation progress line */}
          <View style={styles.allocStatusRow}>
            <View style={styles.allocProgressTrack}>
              <View
                style={[
                  styles.allocProgressFill,
                  {
                    width: `${allocatedPct}%` as any,
                    backgroundColor: COLORS.emerald,
                  },
                ]}
              />
            </View>
            <Text style={styles.allocPctLabel}>{allocatedPct}% allocated</Text>
          </View>
        </View>

        {/* ── Bucket Cards ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget Buckets</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>Add bucket</Text>
            </TouchableOpacity>
          </View>

          {BUCKETS.map((bucket, i) => (
            <View key={bucket.id} style={i > 0 ? styles.mt10 : undefined}>
              <BucketCard bucket={bucket} />
            </View>
          ))}
        </View>

        {/* ── Bottom advisory ─────────────────────────────── */}
        <View style={styles.advisoryCard}>
          <View style={styles.advisoryHeader}>
            <Ionicons name="bulb-outline" size={16} color={COLORS.gold} />
            <Text style={styles.advisoryTitle}>Steward Tip</Text>
          </View>
          <Text style={styles.advisoryText}>
            Your savings rate of 22% is above the recommended 20% — great discipline.
            Consider moving 3% from Entertainment to your Emergency Fund to hit
            3 months coverage faster.
          </Text>
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

  // Fixed header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  headerSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  saveBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  saveBtnText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.bg,
  },

  // Summary card
  summaryCard: {
    margin: 20,
    marginBottom: 8,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  summaryLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryTotal: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  remainingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.emeraldBg,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  remainingText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: COLORS.emerald,
  },

  // Stacked bar
  stackedBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  stackedSegment: {
    height: 12,
    borderRadius: 2,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: COLORS.textMuted,
  },

  // Allocation status bar
  allocStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  allocProgressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  allocProgressFill: {
    height: 5,
    borderRadius: 3,
  },
  allocPctLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.emerald,
    minWidth: 90,
    textAlign: 'right',
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
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

  // Bucket cards
  bucketCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  bucketTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bucketIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  bucketName: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
  },
  bucketAmountBlock: {
    alignItems: 'flex-end',
  },
  bucketAmount: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 1,
  },
  bucketPct: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  thresholdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  thresholdText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    flex: 1,
  },

  // Advisory card
  advisoryCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.goldBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    padding: 14,
  },
  advisoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  advisoryTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.gold,
  },
  advisoryText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
