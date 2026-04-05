import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt } from '@/utils/currency';
import type { IncomeSource, Allocation, Milestone } from '@/types/database';

const MILESTONE_COLORS = ['#60A5FA','#10B97A','#C9943F','#A78BFA','#F472B6','#F59E0B','#34D399','#818CF8'];

// ─── Grade Engine ─────────────────────────────────────────────────────────────
function calcGrade(sources: IncomeSource[], allocs: Allocation[]) {
  const totalIncome = sources.reduce((s, r) => s + r.amount, 0);
  const totalAllocated = allocs.reduce((s, r) => s + r.amount, 0);

  // 1. Allocation completeness (0–25)
  const allocPct = totalIncome > 0 ? (totalAllocated / totalIncome) * 100 : 0;
  const allocScore = allocPct >= 99 ? 25 : Math.round((allocPct / 100) * 25);

  // 2. Savings rate (0–25) — target 20%+
  const savingsAlloc = allocs.find((a) => a.bucket_name === 'Savings');
  const savingsPct = savingsAlloc ? Number(savingsAlloc.pct) : 0;
  const savingsScore = savingsPct >= 20 ? 25 : Math.round((savingsPct / 20) * 25);

  // 3. Housing threshold (0–20) — ceiling 30%
  const housingAlloc = allocs.find((a) => a.bucket_name === 'Rent & Housing');
  const housingPct = housingAlloc ? Number(housingAlloc.pct) : 0;
  const housingScore =
    housingPct === 0 ? 20 :
    housingPct <= 28 ? 20 :
    housingPct <= 30 ? 14 :
    housingPct <= 35 ? 8 : 4;

  // 4. Emergency fund contribution (0–15) — target 10%+
  const emergencyAlloc = allocs.find((a) => a.bucket_name === 'Emergency Fund');
  const emergencyPct = emergencyAlloc ? Number(emergencyAlloc.pct) : 0;
  const emergencyScore = emergencyPct >= 10 ? 15 : Math.round((emergencyPct / 10) * 15);

  // 5. Diversified income (0–15) — multiple sources
  const sourceScore = sources.length >= 3 ? 15 : sources.length === 2 ? 12 : sources.length === 1 ? 8 : 0;

  const total = allocScore + savingsScore + housingScore + emergencyScore + sourceScore;

  const grade =
    total >= 93 ? 'A+' :
    total >= 87 ? 'A'  :
    total >= 83 ? 'A-' :
    total >= 80 ? 'B+' :
    total >= 75 ? 'B'  :
    total >= 70 ? 'B-' :
    total >= 65 ? 'C+' :
    total >= 60 ? 'C'  :
    total >= 55 ? 'C-' :
    total >= 50 ? 'D'  : 'F';

  return {
    grade, total,
    dimensions: [
      { label: 'Income Allocation',    score: allocScore,     max: 25 },
      { label: 'Savings Rate',         score: savingsScore,   max: 25 },
      { label: 'Housing Threshold',    score: housingScore,   max: 20 },
      { label: 'Emergency Fund',       score: emergencyScore, max: 15 },
      { label: 'Income Diversification', score: sourceScore,  max: 15 },
    ],
    allocPct, savingsPct, housingPct, emergencyPct,
    totalIncome, totalAllocated,
    sourceCount: sources.length,
  };
}

type GradeData = ReturnType<typeof calcGrade>;

// fmt imported from utils/currency

// ─── Components ───────────────────────────────────────────────────────────────
function GradeRing({ grade, score, colors, isDark }: { grade: string; score: number; colors: any; isDark: boolean }) {
  const gradeColor =
    score >= 80 ? colors.success :
    score >= 65 ? colors.gold :
    score >= 50 ? colors.warning :
    colors.danger;

  return (
    <View style={[gr.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
      <View style={gr.header}>
        <View style={[gr.divLine, { backgroundColor: colors.border }]} />
        <Text style={[gr.waecLabel, { color: colors.textMuted }]}>W·A·E·C  REPORT CARD</Text>
        <View style={[gr.divLine, { backgroundColor: colors.border }]} />
      </View>
      <Text style={[gr.subLabel, { color: colors.textMuted }]}>Steward Financial Intelligence</Text>

      {/* SVG Circular Gauge Ring */}
      <View style={{ width: 172, height: 172, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Svg width={172} height={172} style={{ position: 'absolute' }}>
          {/* Track circle */}
          <Circle
            cx={86} cy={86} r={62}
            fill="none"
            stroke={gradeColor + '28'}
            strokeWidth={10}
          />
          {/* Score arc */}
          <Circle
            cx={86} cy={86} r={62}
            fill="none"
            stroke={gradeColor}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 2 * Math.PI * 62} ${2 * Math.PI * 62}`}
            transform={`rotate(-90, 86, 86)`}
          />
        </Svg>
        {/* Center content */}
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 120, height: 120, borderRadius: 60, backgroundColor: gradeColor + '18' }}>
          <Text style={[gr.gradeLetter, { color: gradeColor }]}>{grade}</Text>
        </View>
      </View>

      <Text style={[gr.scoreText, { color: colors.textSecondary }]}>
        Score <Text style={[gr.scoreNum, { color: gradeColor, fontFamily: FONTS.display }]}>{score}</Text>
        <Text style={{ color: colors.textMuted }}> / 100</Text>
      </Text>
      <Text style={[gr.period, { color: colors.textMuted }]}>
        {new Date().toLocaleString('en-NG', { month: 'long', year: 'numeric' })} · Monthly Report
      </Text>

      <View style={[gr.barTrack, { backgroundColor: colors.border }]}>
        <View style={[gr.barFill, { width: `${score}%` as any, backgroundColor: gradeColor }]} />
      </View>

      <TouchableOpacity
        style={[gr.shareRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() =>
          Share.share({ message: `My Steward financial grade for this month: ${grade} (${score}/100). Give every naira a purpose — stewardapp.com` })
        }
      >
        <Ionicons name="share-social-outline" size={14} color={colors.textMuted} />
        <Text style={[gr.shareText, { color: colors.textMuted }]}>Share your grade</Text>
      </TouchableOpacity>
    </View>
  );
}

const gr = StyleSheet.create({
  card: { margin: 20, marginBottom: 8, borderRadius: 24, padding: 28, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, width: '100%' },
  divLine: { flex: 1, height: 1 },
  waecLabel: { fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 3 },
  subLabel: { fontFamily: FONTS.regular, fontSize: 12, marginBottom: 24 },
  gradeLetter: { fontFamily: FONTS.display, fontSize: 62, lineHeight: 68, letterSpacing: -2 },
  scoreText: { fontFamily: FONTS.semibold, fontSize: 16, marginBottom: 4 },
  scoreNum: { fontSize: 26 },
  period: { fontFamily: FONTS.regular, fontSize: 12, marginBottom: 16 },
  barTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  barFill: { height: 6, borderRadius: 3 },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1,
  },
  shareText: { fontFamily: FONTS.medium, fontSize: 12 },
});

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyReport({ colors }: { colors: any }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Ionicons name="stats-chart-outline" size={56} color={colors.textMuted} />
      <Text style={{ fontFamily: FONTS.heading, fontSize: 20, color: colors.textPrimary, marginTop: 16, marginBottom: 8, textAlign: 'center' }}>
        No data yet
      </Text>
      <Text style={{ fontFamily: FONTS.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
        Add income sources and save your monthly allocation to generate your W.A.E.C. report.
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ReportScreen() {
  const { colors, isDark } = useTheme();
  const { user, household, currency } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GradeData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const db = supabase as any;
    const srcQ = household
      ? db.from('income_sources').select('*').eq('household_id', household.id)
      : db.from('income_sources').select('*').eq('user_id', user.id).is('household_id', null);
    const allQ = household
      ? db.from('allocations').select('*').eq('household_id', household.id).eq('month', month).eq('year', year)
      : db.from('allocations').select('*').eq('user_id', user.id).is('household_id', null).eq('month', month).eq('year', year);
    const mlQ = db.from('milestones').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(4);

    const [{ data: sources }, { data: allocs }, { data: mls }] = await Promise.all([srcQ, allQ, mlQ]);

    if (sources && allocs) {
      setData(calcGrade(sources, allocs));
    }
    if (mls) setMilestones(mls);
    setLoading(false);
  }, [user, household, month, year]);

  useEffect(() => { load(); }, [load]);

  const s = makeStyles(colors, isDark);

  if (loading) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  const hasData = data && (data.sourceCount > 0);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Financial Report</Text>
          <Text style={s.headerSub}>
            {now.toLocaleString('en-NG', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={load}>
          <Ionicons name="refresh-outline" size={20} color={colors.gold} />
        </TouchableOpacity>
      </View>

      {!hasData ? (
        <EmptyReport colors={colors} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          {/* Grade Ring */}
          <GradeRing grade={data!.grade} score={data!.total} colors={colors} isDark={isDark} />

          {/* Performance Breakdown */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Performance Breakdown</Text>
            <View style={s.dimensionsCard}>
              {data!.dimensions.map((dim, i) => {
                const pct = Math.round((dim.score / dim.max) * 100);
                return (
                  <View key={dim.label}>
                    {i > 0 && <View style={s.divider} />}
                    <View style={s.dimRow}>
                      <Text style={s.dimLabel}>{dim.label}</Text>
                      <View style={s.dimRight}>
                        <View style={s.miniBarContainer}>
                          <View style={s.miniBarTrack}>
                            <View style={[s.miniBarFill, { width: `${pct}%` as any, backgroundColor: colors.gold }]} />
                          </View>
                        </View>
                        <Text style={s.dimScore}>{dim.score}/{dim.max}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Threshold Alerts */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Threshold Alerts</Text>
            </View>
            <View style={s.alertsCard}>
              {[
                {
                  label: 'Rent & Housing',
                  icon: 'home-outline' as const,
                  value: `${data!.housingPct.toFixed(1)}%`,
                  threshold: '28–30% limit',
                  status: data!.housingPct > 30 ? 'danger' : data!.housingPct > 28 ? 'warning' : 'success',
                },
                {
                  label: 'Savings Rate',
                  icon: 'business-outline' as const,
                  value: `${data!.savingsPct.toFixed(1)}%`,
                  threshold: '20% minimum',
                  status: data!.savingsPct < 20 ? 'danger' : 'success',
                },
                {
                  label: 'Emergency Fund',
                  icon: 'shield-checkmark-outline' as const,
                  value: `${data!.emergencyPct.toFixed(1)}%`,
                  threshold: '10–15% target',
                  status: data!.emergencyPct < 10 ? 'warning' : 'success',
                },
                {
                  label: 'Allocation Complete',
                  icon: 'checkmark-circle-outline' as const,
                  value: `${data!.allocPct.toFixed(0)}%`,
                  threshold: '100% required',
                  status: data!.allocPct >= 99 ? 'success' : 'danger',
                },
              ].map((alert, i) => {
                const bgKey = alert.status + 'Bg';
                const colorKey = alert.status;
                const c = colors as Record<string, string>;
                const bg = c[bgKey] + 'AA';
                const fg = c[colorKey];
                const pillIcon = alert.status === 'success' ? 'checkmark-circle-outline'
                  : alert.status === 'warning' ? 'warning-outline' : 'close-circle-outline';

                return (
                  <View key={alert.label}>
                    {i > 0 && <View style={s.divider} />}
                    <View style={[s.alertRow, { borderLeftColor: fg }]}>
                      <View style={[s.alertIconWrap, { backgroundColor: c[bgKey] }]}>
                        <Ionicons name={alert.icon} size={16} color={fg} />
                      </View>
                      <View style={s.alertInfo}>
                        <Text style={s.alertLabel}>{alert.label}</Text>
                        <Text style={s.alertThreshold}>{alert.threshold}</Text>
                      </View>
                      <View style={s.alertRight}>
                        <View style={[s.statusPill, { backgroundColor: c[bgKey] }]}>
                          <Ionicons name={pillIcon as any} size={10} color={fg} />
                          <Text style={[s.statusText, { color: fg }]}>
                            {alert.status.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={s.alertValue}>{alert.value}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Milestone Countdown Cards */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Ionicons name="compass-outline" size={16} color={colors.gold} style={{ marginRight: 6 }} />
              <Text style={s.sectionTitle}>Goal Tracker</Text>
            </View>
            {milestones.length === 0 ? (
              <Text style={[s.emptyGoals, { color: colors.textMuted }]}>
                No goals set yet — visit the Plan tab to add your first milestone.
              </Text>
            ) : (
              <View style={s.alertsCard}>
                {milestones.map((m, i) => {
                  const color = MILESTONE_COLORS[i % MILESTONE_COLORS.length];
                  const prog = m.target_amount > 0 ? Math.min(m.saved_amount / m.target_amount, 1) : 0;
                  const remaining = Math.max(0, m.target_amount - m.saved_amount);
                  const monthsLeft = m.monthly_saving > 0 ? Math.ceil(remaining / m.monthly_saving) : null;
                  const required = m.deadline_months && m.deadline_months > 0
                    ? remaining / m.deadline_months : null;
                  const status =
                    m.saved_amount >= m.target_amount ? { label: 'Completed', color: colors.emerald, bg: colors.emeraldBg } :
                    !required ? { label: 'Active', color: colors.gold, bg: colors.goldBg } :
                    m.monthly_saving >= required ? { label: 'On Track', color: colors.emerald, bg: colors.emeraldBg } :
                    m.monthly_saving >= required * 0.8 ? { label: 'At Risk', color: colors.warning, bg: colors.warningBg } :
                    { label: 'Behind', color: colors.danger, bg: colors.dangerBg };

                  return (
                    <View key={m.id}>
                      {i > 0 && <View style={s.divider} />}
                      <View style={s.milestoneRow}>
                        <View style={[s.milestoneIconWrap, { backgroundColor: color + '22' }]}>
                          <Ionicons name={(m.icon || 'flag-outline') as any} size={18} color={color} />
                        </View>
                        <View style={s.milestoneInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={[s.milestoneName, { color: colors.textPrimary }]} numberOfLines={1}>{m.name}</Text>
                            <View style={[s.milestoneBadge, { backgroundColor: status.bg }]}>
                              <Text style={[s.milestoneBadgeText, { color: status.color }]}>{status.label}</Text>
                            </View>
                          </View>
                          <View style={[s.milestoneBarTrack, { backgroundColor: colors.border }]}>
                            <View style={[s.milestoneBarFill, { width: `${Math.round(prog * 100)}%` as any, backgroundColor: color }]} />
                          </View>
                          <Text style={[s.milestoneSub, { color: colors.textMuted }]}>
                            {fmt(m.saved_amount, currency)} saved of {fmt(m.target_amount, currency)}
                            {monthsLeft ? `  ·  ~${monthsLeft}mo left` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* AI Advisory */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Steward Advisory</Text>
            <LinearGradient
              colors={isDark ? ['#1e2021', '#282a2b'] : ['#7a5a1a', '#9a7232']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.advisoryCard, { borderColor: colors.goldDim }]}
            >
              <View style={[s.advisoryStripe, { backgroundColor: 'rgba(235,192,118,0.6)' }]} />
              <View style={s.advisoryTop}>
                <View style={[s.advisoryIconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                  <Ionicons name="sparkles-outline" size={18} color="#ffdeaa" />
                </View>
                <Text style={[s.advisoryTitle, { color: 'rgba(255,255,255,0.92)' }]}>Steward Advisory</Text>
                <Text style={[s.advisoryMeta, { color: 'rgba(255,255,255,0.55)' }]}>
                  AI · {new Date().toLocaleString('en-NG', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <Text style={[s.advisoryText, { color: 'rgba(255,255,255,0.82)' }]}>
                {'"'}
                {data!.savingsPct >= 20
                  ? `Your savings rate of ${data!.savingsPct.toFixed(0)}% is commendable — above the 20% benchmark. `
                  : `Your savings rate is ${data!.savingsPct.toFixed(0)}% — below the 20% target. Consider reallocating from entertainment to savings. `}
                {data!.housingPct > 30
                  ? `Your housing cost exceeds the 30% safe ceiling by ${(data!.housingPct - 30).toFixed(1)}%. You need ${fmt(Math.round(data!.totalIncome * (100 / 28) - data!.totalIncome), currency)} more monthly income for this to be comfortable. `
                  : data!.housingPct > 28
                  ? `Housing is near the 30% threshold. Monitor this closely. `
                  : `Housing is within the safe 28–30% range. `}
                {data!.emergencyPct < 10
                  ? `Your emergency fund contribution is low. Aim for 10–15% to build 3 months of coverage within a year.`
                  : `Your emergency fund is being well-funded. Keep the momentum.`}
                {'"'}
              </Text>
            </LinearGradient>
          </View>

          {/* Download CTA */}
          <View style={s.section}>
            <TouchableOpacity
              style={[s.downloadBtn, { borderWidth: 1.5, borderColor: colors.gold }]}
              activeOpacity={0.85}
              onPress={() =>
                Alert.alert('Coming Soon', 'PDF download will be available in the next update.')
              }
            >
              <Ionicons name="document-text-outline" size={20} color={colors.gold} />
              <Text style={[s.downloadText, { color: colors.gold }]}>
                Download Report PDF
              </Text>
            </TouchableOpacity>
            <Text style={[s.downloadHint, { color: colors.textMuted }]}>
              Shareable · Branded PDF · Coming soon
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingBottom: 40 },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14,
    },
    headerTitle: { fontFamily: FONTS.heading, fontSize: 24, color: colors.textPrimary, marginBottom: 2 },
    headerSub: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary },
    refreshBtn: {
      width: 40, height: 40, borderRadius: 14,
      backgroundColor: colors.goldBg, borderWidth: 1, borderColor: colors.goldDim,
      alignItems: 'center', justifyContent: 'center',
    },

    section: { paddingHorizontal: 20, marginTop: 20, marginBottom: 4 },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary, marginBottom: 10 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },

    dimensionsCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border, overflow: 'hidden',
    },
    dimRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
    dimLabel: { fontFamily: FONTS.medium, fontSize: 13, color: colors.textSecondary, flex: 1 },
    dimRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    miniBarContainer: { width: 80 },
    miniBarTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
    miniBarFill: { height: 4, borderRadius: 2 },
    dimScore: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textPrimary, minWidth: 36, textAlign: 'right' },

    alertsCard: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: isDark ? 1 : 0, borderColor: colors.border, overflow: 'hidden',
    },
    alertRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 10, borderLeftWidth: 3, borderLeftColor: 'transparent' },
    alertIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    alertInfo: { flex: 1 },
    alertLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary, marginBottom: 2 },
    alertThreshold: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted },
    alertRight: { alignItems: 'flex-end', gap: 4 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
    statusText: { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.5 },
    alertValue: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary },

    emptyGoals: { fontFamily: FONTS.regular, fontSize: 13, textAlign: 'center', paddingVertical: 16, fontStyle: 'italic' },
    milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
    milestoneIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    milestoneInfo: { flex: 1, minWidth: 0 },
    milestoneName: { fontFamily: FONTS.semibold, fontSize: 13, flex: 1, marginRight: 8 },
    milestoneBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
    milestoneBadgeText: { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.4 },
    milestoneBarTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 5 },
    milestoneBarFill: { height: 4, borderRadius: 2 },
    milestoneSub: { fontFamily: FONTS.regular, fontSize: 11 },

    advisoryCard: {
      borderRadius: 16, borderWidth: 1, padding: 20, overflow: 'hidden',
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 2,
    },
    advisoryStripe: { height: 3, borderRadius: 2, marginBottom: 16 },
    advisoryTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    advisoryIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    advisoryTitle: { fontFamily: FONTS.semibold, fontSize: 14, flex: 1 },
    advisoryMeta: { fontFamily: FONTS.medium, fontSize: 12 },
    advisoryText: { fontFamily: FONTS.headingItalic, fontSize: 14, lineHeight: 22 },

    downloadBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 10, borderRadius: 16, height: 54, marginBottom: 8,
    },
    downloadText: { fontFamily: FONTS.semibold, fontSize: 15 },
    downloadHint: { fontFamily: FONTS.regular, fontSize: 12, textAlign: 'center', marginTop: 4 },
  });
}
