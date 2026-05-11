import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Text as SvgText, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt } from '@/utils/currency';
import type { IncomeSource, Allocation, Milestone } from '@/types/database';
import WeeklyDigest from '@/src/components/WeeklyDigest';

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

// ─── Smart Advisory Builder ────────────────────────────────────────────────────
function buildSmartAdvisory(data: GradeData, actualSpends: Record<string, number>): string {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const daysLeft = daysInMonth - daysPassed;
  const monthProgress = (daysPassed / daysInMonth) * 100;

  const lines: string[] = [];

  // Savings rate
  if (data.savingsPct >= 20) {
    lines.push(`Your savings rate of ${data.savingsPct.toFixed(0)}% is above the 20% benchmark — excellent discipline.`);
  } else if (data.savingsPct > 0) {
    lines.push(`Your savings rate of ${data.savingsPct.toFixed(0)}% is below the 20% target. Redirecting even ${Math.round(20 - data.savingsPct)}% more would make a significant difference over 12 months.`);
  } else {
    lines.push(`No savings allocation detected. Even a small starting rate of 10% builds the habit that leads to long-term financial freedom.`);
  }

  // Housing
  if (data.housingPct > 30) {
    lines.push(`Housing is at ${data.housingPct.toFixed(1)}% — ${(data.housingPct - 30).toFixed(1)}% above the safe ceiling. This constrains every other budget category.`);
  } else if (data.housingPct > 28) {
    lines.push(`Housing is at ${data.housingPct.toFixed(1)}% — near the 30% ceiling. Monitor it as any rent increase could tip the balance.`);
  } else if (data.housingPct > 0) {
    lines.push(`Housing is within the healthy 28–30% range. Well managed.`);
  }

  // Actual spend insights (if available)
  const foodSpent = actualSpends['Food'] ?? 0;
  const allocations = data;
  if (foodSpent > 0 && monthProgress < 90) {
    const foodBudgetApprox = data.totalAllocated * 0.10; // rough proxy
    const foodRatio = foodBudgetApprox > 0 ? foodSpent / foodBudgetApprox : 0;
    if (foodRatio > 0.8 && daysLeft > 7) {
      lines.push(`Food spend is at ${Math.round(foodRatio * 100)}% of budget with ${daysLeft} days remaining — consider meal planning to avoid overage.`);
    }
  }

  // Emergency fund
  if (data.emergencyPct < 10) {
    lines.push(`Emergency fund at ${data.emergencyPct.toFixed(1)}%. At this rate it will take ${data.emergencyPct > 0 ? Math.ceil(30 / data.emergencyPct) : '—'} months to reach 3-month coverage.`);
  } else {
    lines.push(`Emergency fund is being well-funded at ${data.emergencyPct.toFixed(1)}%. Keep the momentum.`);
  }

  // Income diversification
  if (data.sourceCount === 1) {
    lines.push(`Single income stream detected. A second source — even freelance — significantly reduces financial risk.`);
  } else if (data.sourceCount >= 3) {
    lines.push(`${data.sourceCount} income sources provide solid diversification. Continue to nurture each stream.`);
  }

  return lines.join(' ');
}

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

      {/* Grade Ring */}
      <View style={[gr.outerRing, { borderColor: gradeColor + '28' }]}>
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
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  ring: { width: 160, height: 160, borderRadius: 80, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 136, height: 136, borderRadius: 68, alignItems: 'center', justifyContent: 'center' },
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
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GradeData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [actualSpends, setActualSpends] = useState<Record<string, number>>({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [showWeeklyDigest, setShowWeeklyDigest] = useState(false);
  const [trendScores, setTrendScores] = useState<{ label: string; score: number }[]>([]);

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
    const mlQ = household
      ? db.from('milestones').select('*').eq('household_id', household.id).order('created_at', { ascending: true }).limit(4)
      : db.from('milestones').select('*').eq('user_id', user.id).is('household_id', null).order('created_at', { ascending: true }).limit(4);

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
    let txnQ = db.from('transactions').select('category, amount').eq('type', 'expense').gte('date', start).lt('date', end);
    txnQ = household ? txnQ.eq('household_id', household.id) : txnQ.eq('user_id', user.id).is('household_id', null);

    const [{ data: sources }, { data: allocs }, { data: mls }, { data: txns }] = await Promise.all([srcQ, allQ, mlQ, txnQ]);

    if (sources && allocs) {
      setData(calcGrade(sources, allocs));

      // Build 6-month grade trend using current sources as income proxy
      if (sources.length > 0) {
        const trend: { label: string; score: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const m = d.getMonth() + 1;
          const y = d.getFullYear();
          let q = db.from('allocations').select('*').eq('month', m).eq('year', y);
          q = household ? q.eq('household_id', household.id) : q.eq('user_id', user.id).is('household_id', null);
          const { data: histAllocs } = await q;
          if (histAllocs && histAllocs.length > 0) {
            const { total } = calcGrade(sources, histAllocs);
            trend.push({ label: d.toLocaleString('en-NG', { month: 'short' }), score: total });
          } else {
            trend.push({ label: d.toLocaleString('en-NG', { month: 'short' }), score: 0 });
          }
        }
        setTrendScores(trend);
      }
    }
    if (mls) setMilestones(mls);

    // Aggregate actual spends by category
    const sums: Record<string, number> = {};
    for (const row of (txns ?? []) as Array<{ category: string; amount: number }>) {
      sums[row.category] = (sums[row.category] ?? 0) + row.amount;
    }
    setActualSpends(sums);

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

          {/* 6-Month Score Trend */}
          {trendScores.some((t) => t.score > 0) && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Score Trend</Text>
              <View style={[s.dimensionsCard, { padding: 16 }]}>
                {(() => {
                  const W = 280;
                  const H = 64;
                  const pad = 8;
                  const validScores = trendScores.filter((t) => t.score > 0);
                  const maxScore = Math.max(...validScores.map((t) => t.score), 1);
                  const barW = (W - pad * 2) / trendScores.length - 4;

                  return (
                    <View style={{ alignItems: 'center' }}>
                      <Svg width={W} height={H + 20}>
                        {trendScores.map((t, i) => {
                          const barH = t.score > 0 ? Math.max((t.score / 100) * H, 4) : 2;
                          const x = pad + i * ((W - pad * 2) / trendScores.length) + 2;
                          const y = H - barH;
                          const barColor = t.score >= 80 ? '#10B97A' : t.score >= 65 ? '#D4AF37' : t.score >= 50 ? '#F59E0B' : t.score > 0 ? '#EF4444' : '#E5E7EB';
                          return (
                            <React.Fragment key={i}>
                              <Rect
                                x={x} y={y} width={barW} height={barH}
                                rx={3} fill={barColor}
                                opacity={t.score > 0 ? 1 : 0.3}
                              />
                              <SvgText
                                x={x + barW / 2} y={H + 14}
                                fontSize={8} fill={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)'}
                                textAnchor="middle" fontFamily={FONTS.medium}
                              >
                                {t.label}
                              </SvgText>
                              {t.score > 0 && (
                                <SvgText
                                  x={x + barW / 2} y={y - 3}
                                  fontSize={7} fill={barColor}
                                  textAnchor="middle" fontFamily={FONTS.semibold}
                                >
                                  {t.score}
                                </SvgText>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </Svg>
                    </View>
                  );
                })()}
              </View>
            </View>
          )}

          {/* Grade History & Streaks */}
          {trendScores.some((t) => t.score > 0) && (() => {
            // Compute current streak (consecutive months from most recent with score >= 75)
            const reversed = [...trendScores].reverse();
            let streak = 0;
            for (const t of reversed) {
              if (t.score >= 75) streak++;
              else if (t.score > 0) break; // scored but below B — streak broken
            }
            const best = Math.max(...trendScores.filter((t) => t.score > 0).map((t) => t.score));
            const gradeHistory = trendScores.filter((t) => t.score > 0).reverse();

            const letterForScore = (s: number) =>
              s >= 93 ? 'A+' : s >= 87 ? 'A' : s >= 83 ? 'A-' : s >= 80 ? 'B+' :
              s >= 75 ? 'B' : s >= 70 ? 'B-' : s >= 65 ? 'C+' : s >= 60 ? 'C' :
              s >= 55 ? 'C-' : s >= 50 ? 'D' : 'F';

            const colorForScore = (s: number) =>
              s >= 80 ? colors.success : s >= 65 ? colors.gold : s >= 50 ? colors.warning : colors.danger;

            return (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Grade History</Text>

                {/* Streak badge row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={[s.streakCard, { backgroundColor: streak >= 3 ? colors.goldBg : colors.card, borderColor: streak >= 3 ? colors.gold + '55' : colors.border }]}>
                    <Text style={{ fontSize: 22 }}>{streak >= 3 ? '🔥' : streak >= 1 ? '⚡' : '💤'}</Text>
                    <View>
                      <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: streak >= 1 ? colors.gold : colors.textMuted, lineHeight: 26 }}>
                        {streak}
                      </Text>
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted }}>
                        {streak === 1 ? 'month streak' : 'month streak'}
                      </Text>
                    </View>
                  </View>
                  <View style={[s.streakCard, { flex: 1, backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="trophy-outline" size={22} color={colors.gold} />
                    <View>
                      <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: colors.gold, lineHeight: 26 }}>
                        {letterForScore(best)}
                      </Text>
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted }}>
                        best grade
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Month-by-month history list */}
                <View style={[s.alertsCard]}>
                  {gradeHistory.map((t, i) => {
                    const letter = letterForScore(t.score);
                    const gc = colorForScore(t.score);
                    return (
                      <View key={t.label}>
                        {i > 0 && <View style={s.divider} />}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: gc + '18', borderWidth: 1, borderColor: gc + '44', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: gc, lineHeight: 22 }}>{letter}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.textPrimary }}>{t.label}</Text>
                            <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 5, overflow: 'hidden' }}>
                              <View style={{ width: `${t.score}%` as any, height: 3, backgroundColor: gc, borderRadius: 2 }} />
                            </View>
                          </View>
                          <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: gc, minWidth: 36, textAlign: 'right' }}>
                            {t.score}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}

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
              colors={isDark ? ['#2e1413', '#4E0B0B'] : ['#7B1515', '#4E0B0B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.advisoryCard, { borderColor: colors.burgundy + '55' }]}
            >
              <View style={[s.advisoryStripe, { backgroundColor: 'rgba(212,175,55,0.50)' }]} />
              <View style={s.advisoryTop}>
                <View style={[s.advisoryIconWrap, { backgroundColor: 'rgba(212,175,55,0.18)' }]}>
                  <Ionicons name="sparkles-outline" size={18} color="#D4AF37" />
                </View>
                <Text style={[s.advisoryTitle, { color: 'rgba(255,255,255,0.92)' }]}>Steward Advisory</Text>
                <Text style={[s.advisoryMeta, { color: 'rgba(255,255,255,0.55)' }]}>
                  AI · {new Date().toLocaleString('en-NG', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <Text style={[s.advisoryText, { color: 'rgba(255,255,255,0.82)' }]}>
                {`"${buildSmartAdvisory(data!, actualSpends)}"`}
              </Text>
            </LinearGradient>
          </View>

          {/* Share Grade Card + Export Report CTAs */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[s.downloadBtn, { backgroundColor: colors.burgundy, borderWidth: 0, flex: 1 }]}
                activeOpacity={0.85}
                onPress={() => setShowShareModal(true)}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.gold} />
                <Text style={[s.downloadText, { color: colors.gold, fontSize: 14 }]}>
                  Share Grade
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.downloadBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flex: 1 }]}
                activeOpacity={0.85}
                onPress={() => {
                  const monthLabel = now.toLocaleString('en-NG', { month: 'long', year: 'numeric' });
                  const spendLines = Object.entries(actualSpends).length > 0
                    ? Object.entries(actualSpends)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, amt]) => `  ${cat.padEnd(14)} ${fmt(amt, currency)}`)
                        .join('\n')
                    : '  No transactions recorded';
                  const dimLines = data!.dimensions
                    .map((d) => `  ${d.label.padEnd(24)} ${d.score}/${d.max}`)
                    .join('\n');
                  Share.share({
                    title: `Steward Report — ${monthLabel}`,
                    message: [
                      `STEWARD FINANCIAL REPORT`,
                      `${monthLabel}`,
                      ``,
                      `GRADE: ${data!.grade}   SCORE: ${data!.total}/100`,
                      ``,
                      `--- SCORE BREAKDOWN ---`,
                      dimLines,
                      ``,
                      `--- KEY METRICS ---`,
                      `  Income Allocated:  ${data!.allocPct.toFixed(0)}%`,
                      `  Savings Rate:      ${data!.savingsPct.toFixed(0)}%`,
                      `  Housing:           ${data!.housingPct.toFixed(0)}%`,
                      `  Emergency Fund:    ${data!.emergencyPct.toFixed(0)}%`,
                      `  Income Sources:    ${data!.sourceCount}`,
                      `  Total Income:      ${fmt(data!.totalIncome, currency)}`,
                      ``,
                      `--- ACTUAL SPENDING ---`,
                      spendLines,
                      ``,
                      `Generated by Steward · stewardapp.com`,
                    ].join('\n'),
                  });
                }}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
                <Text style={[s.downloadText, { color: colors.textSecondary, fontSize: 14 }]}>
                  Export Report
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.downloadHint, { color: colors.textMuted }]}>
              Share grade card or export full text report
            </Text>
          </View>

          {/* Quick action cards — AI Coach + Weekly Digest */}
          <View style={[s.section, { flexDirection: 'row', gap: 10 }]}>
            <TouchableOpacity
              style={[s.quickActionCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}
              activeOpacity={0.8}
              onPress={() => router.push('/ai-coach' as any)}
            >
              <LinearGradient colors={['rgba(78,11,11,0.18)', 'rgba(78,11,11,0.06)']} style={s.quickActionIcon}>
                <Ionicons name="sparkles" size={20} color={colors.burgundy} />
              </LinearGradient>
              <Text style={[s.quickActionTitle, { color: colors.textPrimary }]}>AI Coach</Text>
              <Text style={[s.quickActionSub, { color: colors.textMuted }]}>Ask anything</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.quickActionCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}
              activeOpacity={0.8}
              onPress={() => setShowWeeklyDigest(true)}
            >
              <LinearGradient colors={['rgba(212,175,55,0.18)', 'rgba(212,175,55,0.06)']} style={s.quickActionIcon}>
                <Ionicons name="newspaper-outline" size={20} color={colors.gold} />
              </LinearGradient>
              <Text style={[s.quickActionTitle, { color: colors.textPrimary }]}>Weekly Digest</Text>
              <Text style={[s.quickActionSub, { color: colors.textMuted }]}>This week's recap</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <WeeklyDigest visible={showWeeklyDigest} onClose={() => setShowWeeklyDigest(false)} />

      {/* ── Share Grade Card Modal ────────────────────────────── */}
      <Modal
        visible={showShareModal && data !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={s.modalOverlay}>
          <LinearGradient
            colors={['#4E0B0B', '#210909']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.shareCard}
          >
            {/* Gold stripe accent */}
            <View style={{ height: 3, backgroundColor: colors.gold, borderRadius: 2, marginBottom: 20, opacity: 0.8 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 10, color: 'rgba(212,175,55,0.7)', letterSpacing: 3, marginBottom: 2 }}>
                  W·A·E·C  REPORT CARD
                </Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                  Steward Financial Intelligence
                </Text>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(212,175,55,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sparkles-outline" size={18} color="#D4AF37" />
              </View>
            </View>

            {/* Grade display */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{
                width: 120, height: 120, borderRadius: 60,
                borderWidth: 6, borderColor: '#D4AF37',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(212,175,55,0.10)',
              }}>
                <Text style={{ fontFamily: FONTS.display, fontSize: 52, color: '#D4AF37', lineHeight: 58 }}>
                  {data!.grade}
                </Text>
              </View>
              <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: 'rgba(255,255,255,0.70)', marginTop: 10 }}>
                Score{' '}
                <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#D4AF37' }}>{data!.total}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.40)' }}> / 100</Text>
              </Text>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: 'rgba(255,255,255,0.40)', marginTop: 4 }}>
                {now.toLocaleString('en-NG', { month: 'long', year: 'numeric' })}
              </Text>
            </View>

            {/* Stats grid */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Allocation', value: `${data!.allocPct.toFixed(0)}%` },
                { label: 'Savings Rate', value: `${data!.savingsPct.toFixed(0)}%` },
                { label: 'Housing', value: `${data!.housingPct.toFixed(0)}%` },
                { label: 'Emergency', value: `${data!.emergencyPct.toFixed(0)}%` },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 10, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#D4AF37' }}>{stat.value}</Text>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2, textAlign: 'center' }}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Score bar */}
            <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, marginBottom: 4, overflow: 'hidden' }}>
              <View style={{ width: `${data!.total}%` as any, height: 4, backgroundColor: '#D4AF37', borderRadius: 2 }} />
            </View>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 20, textAlign: 'center' }}>
              stewardapp.com
            </Text>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
                activeOpacity={0.85}
                onPress={() => {
                  const monthLabel = now.toLocaleString('en-NG', { month: 'long', year: 'numeric' });
                  Share.share({
                    title: 'My Steward Financial Grade',
                    message: [
                      `🏆 STEWARD FINANCIAL REPORT — ${monthLabel}`,
                      `━━━━━━━━━━━━━━━━━━`,
                      `Grade: ${data!.grade}   Score: ${data!.total}/100`,
                      `━━━━━━━━━━━━━━━━━━`,
                      `💰 Income Allocated: ${data!.allocPct.toFixed(0)}%`,
                      `📊 Savings Rate: ${data!.savingsPct.toFixed(0)}%`,
                      `🏠 Housing: ${data!.housingPct.toFixed(0)}%`,
                      `🛡 Emergency Fund: ${data!.emergencyPct.toFixed(0)}%`,
                      `━━━━━━━━━━━━━━━━━━`,
                      `Give every coin a purpose — stewardapp.com`,
                    ].join('\n'),
                  });
                }}
              >
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: '#210909' }}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: 'rgba(212,175,55,0.40)', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
                activeOpacity={0.85}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: 'rgba(212,175,55,0.70)' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
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

    streakCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 14, padding: 14, borderWidth: 1,
    },

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

    quickActionCard: {
      borderRadius: 16, borderWidth: isDark ? 1 : 0, padding: 16, alignItems: 'flex-start',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 4, elevation: isDark ? 0 : 2,
    },
    quickActionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    quickActionTitle: { fontFamily: FONTS.semibold, fontSize: 14, marginBottom: 2 },
    quickActionSub: { fontFamily: FONTS.regular, fontSize: 11 },

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    shareCard: {
      width: '100%', maxWidth: 380, borderRadius: 24, padding: 24,
    },
  });
}
