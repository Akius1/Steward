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
import { COLORS, FONTS } from '@/constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount: number) => '₦' + amount.toLocaleString('en-NG');

// ─── Mock Data ────────────────────────────────────────────────────────────────

const GRADE = 'B+';
const SCORE = 78;

const DIMENSIONS = [
  { label: 'Income Allocation',    score: 100, dots: 5 },
  { label: 'Savings Rate',         score: 78,  dots: 4 },
  { label: 'Budget Adherence',     score: 75,  dots: 4 },
  { label: 'Milestone Progress',   score: 62,  dots: 3 },
  { label: 'Threshold Compliance', score: 80,  dots: 4 },
];

type AlertStatus = 'success' | 'warning' | 'danger';

interface ThresholdAlert {
  id: string;
  category: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  threshold: string;
  status: AlertStatus;
  statusLabel: string;
  pct: number;
}

const THRESHOLD_ALERTS: ThresholdAlert[] = [
  {
    id: '1',
    category: 'Rent & Housing',
    icon: 'home-outline',
    value: '₦130,500',
    threshold: '28–30% limit',
    status: 'warning',
    statusLabel: 'AMBER',
    pct: 29,
  },
  {
    id: '2',
    category: 'Food & Groceries',
    icon: 'restaurant-outline',
    value: '₦45,000',
    threshold: '8–10% limit',
    status: 'warning',
    statusLabel: 'AMBER',
    pct: 10,
  },
  {
    id: '3',
    category: 'Savings Rate',
    icon: 'business-outline',
    value: '₦99,000',
    threshold: '20% minimum',
    status: 'success',
    statusLabel: 'GREEN',
    pct: 22,
  },
  {
    id: '4',
    category: 'Emergency Fund',
    icon: 'shield-checkmark-outline',
    value: '1.4 months',
    threshold: '3-month target',
    status: 'danger',
    statusLabel: 'RED',
    pct: 47,
  },
  {
    id: '5',
    category: 'Total Fixed Costs',
    icon: 'receipt-outline',
    value: '₦243,000',
    threshold: '60% ceiling',
    status: 'success',
    statusLabel: 'GREEN',
    pct: 54,
  },
];

const MONTHLY_TREND = [62, 65, 70, 68, 74, 78]; // 6-month scores

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradeRing() {
  const gradeColor =
    SCORE >= 85 ? COLORS.success :
    SCORE >= 70 ? COLORS.gold :
    SCORE >= 55 ? COLORS.warning :
    COLORS.danger;

  return (
    <View style={styles.gradeCard}>
      {/* W.A.E.C. header label */}
      <View style={styles.waecHeader}>
        <View style={styles.waecDividerLine} />
        <Text style={styles.waecLabel}>W·A·E·C  REPORT CARD</Text>
        <View style={styles.waecDividerLine} />
      </View>
      <Text style={styles.waecSubLabel}>Steward Financial Intelligence</Text>

      {/* Grade circle */}
      <View style={[styles.gradeRing, { borderColor: gradeColor }]}>
        <View style={[styles.gradeRingInner, { backgroundColor: gradeColor + '18' }]}>
          <Text style={[styles.gradeLetter, { color: gradeColor }]}>{GRADE}</Text>
        </View>
      </View>

      {/* Score line */}
      <Text style={styles.scoreText}>
        Score <Text style={[styles.scoreNumber, { color: gradeColor }]}>{SCORE}</Text>
        <Text style={styles.scoreOutOf}> / 100</Text>
      </Text>

      {/* Month */}
      <Text style={styles.gradePeriod}>April 2026 · Monthly Report</Text>

      {/* Overall bar */}
      <View style={styles.overallBarTrack}>
        <View
          style={[
            styles.overallBarFill,
            { width: `${SCORE}%` as any, backgroundColor: gradeColor },
          ]}
        />
      </View>

      {/* Share hint */}
      <TouchableOpacity style={styles.shareRow} activeOpacity={0.7}>
        <Ionicons name="share-social-outline" size={14} color={COLORS.textMuted} />
        <Text style={styles.shareText}>Share your grade</Text>
      </TouchableOpacity>
    </View>
  );
}

function DimensionRow({ item }: { item: (typeof DIMENSIONS)[0] }) {
  const filled = Math.round((item.score / 100) * 5);
  return (
    <View style={styles.dimensionRow}>
      <Text style={styles.dimensionLabel}>{item.label}</Text>
      <View style={styles.dimensionRight}>
        <View style={styles.dotsRow}>
          {[1, 2, 3, 4, 5].map((d) => (
            <View
              key={d}
              style={[
                styles.dot,
                d <= filled ? styles.dotFilled : styles.dotEmpty,
              ]}
            />
          ))}
        </View>
        <Text style={styles.dimensionScore}>{item.score}%</Text>
      </View>
    </View>
  );
}

const STATUS_STYLE: Record<AlertStatus, { bg: string; text: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  success: { bg: COLORS.successBg, text: COLORS.success, icon: 'checkmark-circle-outline' },
  warning: { bg: COLORS.warningBg, text: COLORS.warning, icon: 'warning-outline' },
  danger:  { bg: COLORS.dangerBg,  text: COLORS.danger,  icon: 'close-circle-outline' },
};

function AlertRow({ alert }: { alert: ThresholdAlert }) {
  const s = STATUS_STYLE[alert.status];
  return (
    <View style={[styles.alertRow, { backgroundColor: s.bg + 'AA' }]}>
      <View style={[styles.alertIconWrap, { backgroundColor: s.bg }]}>
        <Ionicons name={alert.icon} size={16} color={s.text} />
      </View>
      <View style={styles.alertInfo}>
        <Text style={styles.alertCategory}>{alert.category}</Text>
        <Text style={styles.alertThreshold}>{alert.threshold}</Text>
      </View>
      <View style={styles.alertRight}>
        <View style={[styles.alertStatusPill, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon} size={10} color={s.text} />
          <Text style={[styles.alertStatusText, { color: s.text }]}>{alert.statusLabel}</Text>
        </View>
        <Text style={styles.alertValue}>{alert.value}</Text>
        <View style={styles.alertBarTrack}>
          <View
            style={[
              styles.alertBarFill,
              { width: `${Math.min(alert.pct, 100)}%` as any, backgroundColor: s.text },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function TrendChart() {
  const max = Math.max(...MONTHLY_TREND);
  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <Text style={styles.trendTitle}>6-Month Score Trend</Text>
        <Text style={styles.trendChange}>+16 pts since Nov</Text>
      </View>
      <View style={styles.trendBars}>
        {MONTHLY_TREND.map((score, i) => {
          const isLast = i === MONTHLY_TREND.length - 1;
          const barH = Math.round((score / max) * 56);
          return (
            <View key={i} style={styles.trendBarCol}>
              {isLast && (
                <Text style={styles.trendBarLabel}>{score}</Text>
              )}
              <View
                style={[
                  styles.trendBar,
                  { height: barH, backgroundColor: isLast ? COLORS.gold : COLORS.border },
                ]}
              />
              <Text style={styles.trendMonthLabel}>{months[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      {/* ── Fixed Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Financial Report</Text>
          <Text style={styles.headerSub}>April 2026</Text>
        </View>
        <TouchableOpacity style={styles.downloadIconBtn} activeOpacity={0.8}>
          <Ionicons name="download-outline" size={20} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Grade Card ──────────────────────────────────── */}
        <GradeRing />

        {/* ── Performance Breakdown ───────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Breakdown</Text>
          <View style={styles.dimensionsCard}>
            {DIMENSIONS.map((dim, i) => (
              <View key={dim.label}>
                {i > 0 && <View style={styles.divider} />}
                <DimensionRow item={dim} />
              </View>
            ))}
          </View>
        </View>

        {/* ── Threshold Alerts ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Threshold Alerts</Text>
            <View style={styles.alertCountPill}>
              <Text style={styles.alertCountText}>2 need attention</Text>
            </View>
          </View>
          <View style={styles.alertsCard}>
            {THRESHOLD_ALERTS.map((alert, i) => (
              <View key={alert.id}>
                {i > 0 && <View style={styles.divider} />}
                <AlertRow alert={alert} />
              </View>
            ))}
          </View>
        </View>

        {/* ── 6-Month Trend ────────────────────────────────── */}
        <View style={styles.section}>
          <TrendChart />
        </View>

        {/* ── AI Advisory ──────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Steward Advisory</Text>
          <View style={styles.advisoryCard}>
            <View style={styles.advisoryTop}>
              <View style={styles.advisoryIconWrap}>
                <Ionicons name="sparkles-outline" size={18} color={COLORS.gold} />
              </View>
              <Text style={styles.advisoryMeta}>AI · Generated April 2026</Text>
            </View>
            <Text style={styles.advisoryText}>
              {'"'}Your rent has been near the 30% threshold for 2 consecutive months. You would
              need <Text style={styles.advisoryHighlight}>₦518,000/month</Text> in income for this
              housing cost to be fully comfortable — or consider reviewing your accommodation in
              the next 6 months.{'\n\n'}
              Your savings rate of <Text style={styles.advisoryHighlight}>22%</Text> is strong —
              keep this up. Redirecting just ₦3,000/month from Entertainment to your Emergency
              Fund will close the coverage gap in 14 months.{'"'}
            </Text>
          </View>
        </View>

        {/* ── Download CTA ─────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.85}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.bg} />
            <Text style={styles.downloadBtnText}>Download April 2026 Report PDF</Text>
          </TouchableOpacity>
          <Text style={styles.downloadHint}>
            Shareable · PDF · Includes all charts and advisory
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
  downloadIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.goldBg,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Grade card
  gradeCard: {
    margin: 20,
    marginBottom: 8,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
  },
  waecHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  waecDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  waecLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  waecSubLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 24,
  },
  gradeRing: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  gradeRingInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeLetter: {
    fontFamily: FONTS.display,
    fontSize: 60,
    lineHeight: 66,
    letterSpacing: -2,
  },
  scoreText: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  scoreNumber: {
    fontFamily: FONTS.display,
    fontSize: 22,
  },
  scoreOutOf: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  gradePeriod: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  overallBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  overallBarFill: {
    height: 6,
    borderRadius: 3,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  shareText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  alertCountPill: {
    backgroundColor: COLORS.warningBg,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  alertCountText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    color: COLORS.warning,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },

  // Dimensions card
  dimensionsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  dimensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dimensionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  dimensionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: COLORS.gold,
  },
  dotEmpty: {
    backgroundColor: COLORS.border,
  },
  dimensionScore: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textPrimary,
    minWidth: 38,
    textAlign: 'right',
  },

  // Alerts card
  alertsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  alertIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertInfo: {
    flex: 1,
  },
  alertCategory: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  alertThreshold: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  alertRight: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 80,
  },
  alertStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  alertStatusText: {
    fontFamily: FONTS.semibold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  alertValue: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  alertBarTrack: {
    width: 80,
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  alertBarFill: {
    height: 3,
    borderRadius: 2,
  },

  // Trend chart
  trendCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  trendTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  trendChange: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.emerald,
  },
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
  },
  trendBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  trendBarLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    color: COLORS.gold,
    marginBottom: 2,
  },
  trendBar: {
    width: 28,
    borderRadius: 4,
    minHeight: 4,
  },
  trendMonthLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // AI Advisory
  advisoryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    padding: 16,
  },
  advisoryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  advisoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisoryMeta: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  advisoryText: {
    fontFamily: FONTS.headingItalic,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  advisoryHighlight: {
    fontFamily: FONTS.headingItalic,
    color: COLORS.gold,
  },

  // Download button
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 8,
  },
  downloadBtnText: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: COLORS.bg,
  },
  downloadHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});
