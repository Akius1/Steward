import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, ActivityIndicator, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt } from '@/utils/currency';

interface DigestData {
  weekSpent: number;
  topCategory: string;
  topCategoryAmt: number;
  monthGrade: string;
  monthScore: number;
  streak: number;
  tip: string;
}

const WEEKLY_TIPS = [
  "Track every transaction this week — awareness alone cuts spending by 15%.",
  "Move this week's leftover to savings before you spend it. Pay yourself first.",
  "Review your Food budget mid-week to avoid last-minute overspending.",
  "A single no-spend day saves the equivalent of a month's coffee habit annually.",
  "Your Emergency Fund is your financial immune system. Feed it every month.",
  "Income diversification is the best hedge against uncertainty. Start a side skill.",
  "The best investment you can make is in a budget you actually follow.",
  "Automate your savings. Willpower is finite — systems are not.",
];

function getDayOfWeek() { return new Date().getDay(); } // 0 = Sunday

function getThisWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay()); // Sunday
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function gradeForScore(s: number) {
  return s >= 93 ? 'A+' : s >= 87 ? 'A' : s >= 83 ? 'A-' : s >= 80 ? 'B+' :
    s >= 75 ? 'B' : s >= 70 ? 'B-' : s >= 65 ? 'C+' : s >= 60 ? 'C' :
    s >= 55 ? 'C-' : s >= 50 ? 'D' : 'F';
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface WeeklyDigestProps {
  visible: boolean;
  onClose: () => void;
}

export default function WeeklyDigest({ visible, onClose }: WeeklyDigestProps) {
  const { colors, isDark } = useTheme();
  const { user, household, currency, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [digest, setDigest] = useState<DigestData | null>(null);

  useEffect(() => {
    if (visible) loadDigest();
  }, [visible]);

  async function loadDigest() {
    if (!user) return;
    setLoading(true);

    const db = supabase as any;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const { start, end } = getThisWeekRange();

    // Fetch this week's transactions + current allocation grade data
    const [{ data: weekTxns }, { data: allocs }, { data: sources }] = await Promise.all([
      (() => {
        let q = db.from('transactions').select('category, amount').eq('type', 'expense').gte('date', start).lte('date', end);
        return household ? q.eq('household_id', household.id) : q.eq('user_id', user.id).is('household_id', null);
      })(),
      (() => {
        let q = db.from('allocations').select('*').eq('month', month).eq('year', year);
        return household ? q.eq('household_id', household.id) : q.eq('user_id', user.id).is('household_id', null);
      })(),
      household
        ? db.from('income_sources').select('*').eq('household_id', household.id)
        : db.from('income_sources').select('*').eq('user_id', user.id).is('household_id', null),
    ]);

    // Week spending by category
    const catTotals: Record<string, number> = {};
    let weekSpent = 0;
    for (const t of (weekTxns ?? []) as any[]) {
      catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount;
      weekSpent += t.amount;
    }
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    // Grade from current allocations
    const totalIncome = (sources ?? []).reduce((s: number, r: any) => s + r.amount, 0);
    const totalAlloc = (allocs ?? []).reduce((s: number, r: any) => s + r.amount, 0);
    const savingsPct = totalIncome > 0
      ? ((allocs ?? []).find((a: any) => a.bucket_name === 'Savings')?.amount ?? 0) / totalIncome * 100
      : 0;
    const allocPct = totalIncome > 0 ? (totalAlloc / totalIncome) * 100 : 0;
    const score = Math.min(100, Math.round(allocPct * 0.25 + Math.min(savingsPct / 20, 1) * 25 + 50));

    // Streak from last 6 months allocations
    let streak = 0;
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      let q = db.from('allocations').select('id').eq('month', m).eq('year', y);
      q = household ? q.eq('household_id', household.id) : q.eq('user_id', user.id).is('household_id', null);
      const { data } = await q.limit(1);
      if (data && data.length > 0) streak++;
      else break;
    }

    // Random weekly tip seeded by week number
    const weekNum = Math.floor((now.getTime() / 1000 / 60 / 60 / 24 - 4) / 7);
    const tip = WEEKLY_TIPS[weekNum % WEEKLY_TIPS.length];

    setDigest({
      weekSpent,
      topCategory: topCat?.[0] ?? 'None',
      topCategoryAmt: topCat?.[1] ?? 0,
      monthGrade: gradeForScore(score),
      monthScore: score,
      streak,
      tip,
    });
    setLoading(false);
  }

  function handleShare() {
    if (!digest) return;
    const firstName = profile?.name?.split(' ')[0] ?? 'I';
    Share.share({
      title: 'My Steward Weekly Digest',
      message: [
        `📊 STEWARD WEEKLY DIGEST`,
        `━━━━━━━━━━━━━━━━`,
        `Week ending ${new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}`,
        ``,
        `💸 Spent this week: ${fmt(digest.weekSpent, currency)}`,
        `📌 Top category: ${digest.topCategory} (${fmt(digest.topCategoryAmt, currency)})`,
        `🏆 Monthly grade: ${digest.monthGrade} (${digest.monthScore}/100)`,
        `🔥 Planning streak: ${digest.streak} month${digest.streak !== 1 ? 's' : ''}`,
        ``,
        `💡 "${digest.tip}"`,
        ``,
        `Give every coin a purpose — stewardapp.com`,
      ].join('\n'),
    });
  }

  const gradeColor = digest
    ? digest.monthScore >= 80 ? '#10B97A' : digest.monthScore >= 65 ? '#D4AF37' : digest.monthScore >= 50 ? '#F59E0B' : '#EF4444'
    : '#D4AF37';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <LinearGradient colors={['#4E0B0B', '#210909']} style={s.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

          {/* Gold top stripe */}
          <View style={{ height: 3, backgroundColor: '#D4AF37', borderRadius: 2, marginBottom: 20, opacity: 0.8 }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>WEEKLY DIGEST</Text>
              <Text style={s.weekLabel}>
                {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color="#D4AF37" size="large" />
              <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 12 }}>
                Building your digest…
              </Text>
            </View>
          ) : digest ? (
            <>
              {/* Stats grid */}
              <View style={s.statsGrid}>
                <View style={s.statBox}>
                  <Text style={s.statLabel}>Week Spending</Text>
                  <Text style={s.statVal}>{fmt(digest.weekSpent, currency)}</Text>
                  <Text style={s.statSub}>this week</Text>
                </View>
                <View style={[s.statBox, { borderColor: gradeColor }]}>
                  <Text style={s.statLabel}>Monthly Grade</Text>
                  <Text style={[s.statVal, { color: gradeColor, fontFamily: FONTS.display }]}>{digest.monthGrade}</Text>
                  <Text style={s.statSub}>{digest.monthScore}/100</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statLabel}>Streak</Text>
                  <Text style={s.statVal}>{digest.streak} {digest.streak >= 3 ? '🔥' : '📅'}</Text>
                  <Text style={s.statSub}>months planned</Text>
                </View>
              </View>

              {/* Top spend category */}
              {digest.weekSpent > 0 && (
                <View style={s.topCatRow}>
                  <View style={[s.topCatIcon, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
                    <Ionicons name="trending-up-outline" size={16} color="#D4AF37" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.topCatLabel}>Top spend category</Text>
                    <Text style={s.topCatVal}>{digest.topCategory} · {fmt(digest.topCategoryAmt, currency)}</Text>
                  </View>
                </View>
              )}

              {/* Weekly tip */}
              <View style={s.tipBox}>
                <Text style={s.tipEyebrow}>💡 THIS WEEK'S TIP</Text>
                <Text style={s.tipText}>"{digest.tip}"</Text>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                  <Ionicons name="share-social-outline" size={16} color="#210909" />
                  <Text style={s.shareTxt}>Share Digest</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={s.closeTxt}>Done</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </LinearGradient>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', borderRadius: 24, padding: 24 },
  eyebrow: { fontFamily: FONTS.semibold, fontSize: 10, color: 'rgba(212,175,55,0.7)', letterSpacing: 3, marginBottom: 2 },
  weekLabel: { fontFamily: FONTS.heading, fontSize: 18, color: '#FFF' },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center',
  },
  statLabel: { fontFamily: FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  statVal: { fontFamily: FONTS.semibold, fontSize: 16, color: '#D4AF37', textAlign: 'center' },
  statSub: { fontFamily: FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2, textAlign: 'center' },
  topCatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 },
  topCatIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  topCatLabel: { fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 2 },
  topCatVal: { fontFamily: FONTS.semibold, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  tipBox: { backgroundColor: 'rgba(212,175,55,0.10)', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.20)' },
  tipEyebrow: { fontFamily: FONTS.semibold, fontSize: 9, color: 'rgba(212,175,55,0.7)', letterSpacing: 1.5, marginBottom: 6 },
  tipText: { fontFamily: FONTS.headingItalic, fontSize: 13, color: 'rgba(255,255,255,0.80)', lineHeight: 20 },
  shareBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D4AF37', borderRadius: 12, paddingVertical: 13 },
  shareTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: '#210909' },
  closeBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  closeTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: 'rgba(212,175,55,0.70)' },
});
