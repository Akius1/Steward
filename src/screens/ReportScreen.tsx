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
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt } from '@/utils/currency';
import type { IncomeSource, Allocation } from '@/types/database';

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

      {/* Outer depth ring */}
      <View style={[gr.outerRing, { borderColor: gradeColor + '25' }]}>
        <View style={[gr.ring, { borderColor: gradeColor }]}>
          <View style={[gr.ringInner, { backgroundColor: gradeColor + '18' }]}>
            <Text style={[gr.gradeLetter, { color: gradeColor }]}>{grade}</Text>
          </View>
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
  outerRing: {
    width: 172, height: 172, borderRadius: 86,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  ring: { width: 160, height: 160, borderRadius: 80, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
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
    const [{ data: sources }, { data: allocs }] = await Promise.all([srcQ, allQ]);

    if (sources && allocs) {
      setData(calcGrade(sources, allocs));
    }
    setLoading(false);
  }, [user, month, year]);

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
                    <View style={s.alertRow}>
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

          {/* AI Advisory */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Steward Advisory</Text>
            <View style={[s.advisoryCard, { backgroundColor: colors.card, borderColor: colors.goldDim }]}>
              <View style={[s.advisoryStripe, { backgroundColor: colors.gold }]} />
              <View style={s.advisoryTop}>
                <View style={[s.advisoryIconWrap, { backgroundColor: colors.goldBg }]}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.gold} />
                </View>
                <Text style={[s.advisoryTitle, { color: colors.textPrimary }]}>Steward Advisory</Text>
                <Text style={[s.advisoryMeta, { color: colors.textMuted }]}>
                  AI · {new Date().toLocaleString('en-NG', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <Text style={[s.advisoryText, { color: colors.textSecondary }]}>
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
            </View>
          </View>

          {/* Download CTA */}
          <View style={s.section}>
            <TouchableOpacity
              style={[s.downloadBtn, { backgroundColor: colors.gold }]}
              activeOpacity={0.85}
              onPress={() =>
                Alert.alert('Coming Soon', 'PDF download will be available in the next update.')
              }
            >
              <Ionicons name="document-text-outline" size={20} color={isDark ? colors.bg : '#FFF'} />
              <Text style={[s.downloadText, { color: isDark ? colors.bg : '#FFF' }]}>
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
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
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
    alertRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
    alertIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    alertInfo: { flex: 1 },
    alertLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary, marginBottom: 2 },
    alertThreshold: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted },
    alertRight: { alignItems: 'flex-end', gap: 4 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
    statusText: { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.5 },
    alertValue: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary },

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
