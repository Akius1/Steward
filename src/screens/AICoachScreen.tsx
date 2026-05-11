import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, Modal, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';
import { fmt } from '@/utils/currency';

const FREE_LIMIT = 5;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Session-level cache ───────────────────────────────────────────────────────
// Stored outside the component so messages survive tab switches (unmount/remount)
// within the same app session. Reset when the user changes (e.g. sign-out).
let _cachedMessages: Message[] = [];
let _cachedUsed = 0;
let _cachedContextKey = ''; // tracks which user the cache belongs to

const QUICK_PROMPTS = [
  "How is my savings rate?",
  "Can I afford a vacation?",
  "How do I reach my goal faster?",
  "Where should I cut spending?",
  "Am I on track this month?",
];

// ─── Paywall Modal ────────────────────────────────────────────────────────────
function PaywallModal({ visible, used, onClose, colors, isDark }: {
  visible: boolean; used: number; onClose: () => void; colors: any; isDark: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={pw.overlay}>
        <LinearGradient colors={['#4E0B0B', '#210909']} style={pw.card}>
          <View style={pw.iconWrap}>
            <Ionicons name="sparkles" size={32} color="#D4AF37" />
          </View>
          <Text style={pw.title}>You've reached your{'\n'}free limit</Text>
          <Text style={pw.sub}>
            You've used {used}/{FREE_LIMIT} free AI messages this month.{'\n'}
            Upgrade to Steward Premium for unlimited coaching.
          </Text>

          <View style={pw.perks}>
            {[
              'Unlimited AI Coach messages',
              'Priority financial insights',
              'Advanced goal analytics',
              'Early access to new features',
            ].map((p) => (
              <View key={p} style={pw.perkRow}>
                <Ionicons name="checkmark-circle" size={16} color="#D4AF37" />
                <Text style={pw.perkText}>{p}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={pw.upgradeBtn}
            activeOpacity={0.85}
            onPress={() => {
              onClose();
              Alert.alert('Steward Premium', 'In-app subscription coming soon. Stay tuned!');
            }}
          >
            <Text style={pw.upgradeTxt}>Upgrade to Premium</Text>
          </TouchableOpacity>

          <TouchableOpacity style={pw.closeBtn} onPress={onClose}>
            <Text style={pw.closeTxt}>Maybe later</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const pw = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', borderRadius: 24, padding: 28, alignItems: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(212,175,55,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: FONTS.heading, fontSize: 24, color: '#FFF', textAlign: 'center', marginBottom: 10, lineHeight: 30 },
  sub: { fontFamily: FONTS.regular, fontSize: 14, color: 'rgba(255,255,255,0.60)', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  perks: { width: '100%', marginBottom: 24, gap: 10 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkText: { fontFamily: FONTS.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  upgradeBtn: { width: '100%', backgroundColor: '#D4AF37', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  upgradeTxt: { fontFamily: FONTS.semibold, fontSize: 15, color: '#210909' },
  closeBtn: { paddingVertical: 10 },
  closeTxt: { fontFamily: FONTS.medium, fontSize: 14, color: 'rgba(255,255,255,0.40)' },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, colors, isDark }: { msg: Message; colors: any; isDark: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[bl.row, isUser && bl.rowUser]}>
      {!isUser && (
        <View style={bl.avatar}>
          <Ionicons name="sparkles" size={14} color="#D4AF37" />
        </View>
      )}
      <View style={[
        bl.bubble,
        isUser
          ? [bl.bubbleUser, { backgroundColor: colors.burgundy }]
          : [bl.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border }],
      ]}>
        <Text style={[bl.text, { color: isUser ? '#FFF' : colors.textPrimary }]}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

const bl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, paddingHorizontal: 16, gap: 8 },
  rowUser: { flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderBottomLeftRadius: 4, borderWidth: 1 },
  text: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21 },
});

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingDots({ colors }: { colors: any }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay((dots.length - i) * 160),
      ]))
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={[bl.row, { marginBottom: 12 }]}>
      <View style={bl.avatar}>
        <Ionicons name="sparkles" size={14} color="#D4AF37" />
      </View>
      <View style={[bl.bubble, bl.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', gap: 5, paddingVertical: 14 }]}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted, opacity: dot }} />
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AICoachScreen() {
  const { colors, isDark } = useTheme();
  const { user, household, currency, profile } = useAuth();
  const router = useRouter();

  // Restore from session cache if same user, otherwise start fresh
  const cacheKey = user?.id ?? '';
  if (_cachedContextKey && _cachedContextKey !== cacheKey) {
    // Different user — clear stale cache
    _cachedMessages = [];
    _cachedUsed = 0;
    _cachedContextKey = '';
  }

  const [messages, setMessages] = useState<Message[]>(_cachedMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState(_cachedUsed);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  // Skip context reload if we already have messages (returning from another tab)
  const [contextLoading, setContextLoading] = useState(_cachedMessages.length === 0);
  const [financialContext, setFinancialContext] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);

  const isPremiumUser = profile?.subscription === 'premium';

  // ── Load financial context for the system prompt ──────────────────────────
  useEffect(() => {
    async function loadContext() {
      if (!user) return;
      const db = supabase as any;
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Always query both personal and household data, then merge —
      // this handles cases where some data was saved before joining a household
      const [
        { data: sourcesPersonal }, { data: sourcesHousehold },
        { data: allocsPersonal },  { data: allocsHousehold },
        { data: prof },
      ] = await Promise.all([
        db.from('income_sources').select('*').eq('user_id', user.id).is('household_id', null),
        household
          ? db.from('income_sources').select('*').eq('household_id', household.id)
          : Promise.resolve({ data: [] }),
        db.from('allocations').select('*').eq('user_id', user.id).is('household_id', null).eq('month', month).eq('year', year),
        household
          ? db.from('allocations').select('*').eq('household_id', household.id).eq('month', month).eq('year', year)
          : Promise.resolve({ data: [] }),
        db.from('profiles').select('*').eq('id', user.id).single(),
      ]);

      // Merge: prefer household data if available, otherwise fall back to personal
      const sources = (sourcesHousehold?.length ? sourcesHousehold : sourcesPersonal) ?? [];
      const allocs  = (allocsHousehold?.length  ? allocsHousehold  : allocsPersonal)  ?? [];

      const totalIncome    = sources.reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalAllocated = allocs.reduce((s: number, r: any) => s + Number(r.amount), 0);

      // Build savings percentage — sum all savings-related buckets
      const SAVINGS_KEYWORDS = ['saving', 'investment', 'emergency', 'fund'];
      const savingsTotal = allocs
        .filter((a: any) => SAVINGS_KEYWORDS.some(k => a.bucket_name?.toLowerCase().includes(k)))
        .reduce((s: number, a: any) => s + Number(a.amount), 0);
      const savingsPct = totalIncome > 0 ? Math.round((savingsTotal / totalIncome) * 100) : 0;

      const housingBucket = allocs.find((a: any) =>
        a.bucket_name?.toLowerCase().includes('rent') || a.bucket_name?.toLowerCase().includes('housing')
      );
      const housingPct = totalIncome > 0 && housingBucket
        ? Math.round((Number(housingBucket.amount) / totalIncome) * 100) : 0;

      setFinancialContext({
        currency,
        totalIncome: fmt(totalIncome, currency),
        totalAllocated: fmt(totalAllocated, currency),
        allocationPct: totalIncome > 0 ? Math.round((totalAllocated / totalIncome) * 100) : 0,
        savingsPct,
        housingPct,
        incomeSources: sources.length,
        // Send every bucket so Claude has the full picture
        allocations: allocs.map((a: any) => ({
          bucket: a.bucket_name,
          amount: fmt(Number(a.amount), currency),
          pct: `${a.pct ?? Math.round((Number(a.amount) / totalIncome) * 100)}%`,
        })),
      });

      // Load current usage from profile
      const sameMonth = prof?.ai_messages_month === month && prof?.ai_messages_year === year;
      const freshUsed = sameMonth ? (prof?.ai_messages_used ?? 0) : 0;
      setUsed(freshUsed);
      _cachedUsed = freshUsed;
      _cachedContextKey = user.id;
      setIsPremium(prof?.subscription === 'premium');

      setContextLoading(false);
    }
    loadContext();
  }, [user, household, currency]);

  // Greet user on first load (skip if returning from another tab)
  useEffect(() => {
    if (!contextLoading && messages.length === 0) {
      const firstName = profile?.name?.split(' ')[0] ?? 'there';
      const greeting: Message = {
        role: 'assistant',
        content: `Hey ${firstName}! I'm your Steward AI Coach. I have a full picture of your finances and I'm here to help you make smarter money decisions. What's on your mind?`,
      };
      setMessagesCached([greeting]);
      _cachedContextKey = user?.id ?? '';
    }
  }, [contextLoading]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // Sync messages to session cache whenever they change
  const setMessagesCached = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessages((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      _cachedMessages = next;
      return next;
    });
  }, []);

  // Scroll to bottom when returning to screen with existing messages
  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, []);  // only on mount

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || !financialContext) return;

    if (!isPremiumUser && used >= FREE_LIMIT) {
      setShowPaywall(true);
      return;
    }

    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessagesCached(newMessages);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      // Get fresh session — refresh if needed
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: r } = await supabase.auth.refreshSession();
        session = r.session;
      }
      if (!session?.access_token) {
        Alert.alert('Session expired', 'Please sign out and sign back in to use AI Coach.');
        setMessagesCached((prev) => prev.slice(0, -1));
        setLoading(false);
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          financialContext,
        }),
      });

      let data: any = {};
      try { data = await res.json(); } catch {}

      if (res.status === 429 || data?.error === 'limit_exceeded') {
        const newUsed = data?.used ?? FREE_LIMIT;
        setUsed(newUsed);
        _cachedUsed = newUsed;
        setShowPaywall(true);
        setMessagesCached((prev) => prev.slice(0, -1));
        return;
      }

      if (!res.ok) {
        const code = data?.error ?? data?.message ?? `HTTP ${res.status}`;
        console.error('[AI Coach] error:', res.status, data);
        Alert.alert('AI Unavailable', `Could not reach Steward AI (${code}). Please try again.`);
        setMessagesCached((prev) => prev.slice(0, -1));
        return;
      }

      if (!data?.reply) {
        Alert.alert('AI Unavailable', 'Steward AI returned an empty response. Please try again.');
        setMessagesCached((prev) => prev.slice(0, -1));
        return;
      }

      setMessagesCached((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      const newUsed = data.used ?? used + 1;
      setUsed(newUsed);
      _cachedUsed = newUsed;
      setIsPremium(data.isPremium ?? false);
      scrollToBottom();
    } catch (err: any) {
      console.error('[AI Coach] network catch:', err?.message ?? err);
      Alert.alert('Network error', 'Check your connection and try again.');
      setMessagesCached((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [messages, loading, financialContext, used, isPremiumUser, setMessagesCached]);

  const s = makeStyles(colors, isDark);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.headerTitle}>Steward AI Coach</Text>
          <Text style={s.headerSub}>Powered by Claude · Personalized to your data</Text>
        </View>
        {/* Usage pill */}
        {!isPremiumUser && (
          <TouchableOpacity
            onPress={() => setShowPaywall(true)}
            style={[s.usagePill, { backgroundColor: used >= FREE_LIMIT ? colors.dangerBg : colors.goldBg }]}
          >
            <Ionicons name="flash" size={11} color={used >= FREE_LIMIT ? colors.danger : colors.gold} />
            <Text style={[s.usageText, { color: used >= FREE_LIMIT ? colors.danger : colors.gold }]}>
              {used}/{FREE_LIMIT}
            </Text>
          </TouchableOpacity>
        )}
        {isPremiumUser && (
          <View style={[s.usagePill, { backgroundColor: colors.goldBg }]}>
            <Ionicons name="infinite" size={12} color={colors.gold} />
            <Text style={[s.usageText, { color: colors.gold }]}>Premium</Text>
          </View>
        )}
      </View>

      {contextLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginTop: 12 }}>
            Loading your financial context…
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* ── Messages ─────────────────────────────────────── */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg, i) => (
              <Bubble key={i} msg={msg} colors={colors} isDark={isDark} />
            ))}
            {loading && <TypingDots colors={colors} />}
          </ScrollView>

          {/* ── Quick Prompts ─────────────────────────────────── */}
          {messages.length <= 1 && !loading && (
            <View style={{ flexShrink: 0 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.quickRow}
                keyboardShouldPersistTaps="handled"
              >
                {QUICK_PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[s.quickChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => sendMessage(p)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.quickChipText, { color: colors.textSecondary }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Input Bar ─────────────────────────────────────── */}
          <View style={[s.inputBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[s.input, { color: colors.textPrimary }]}
              placeholder="Ask anything about your finances…"
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={400}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage(input)}
              editable={!loading}
            />
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: input.trim() && !loading ? colors.burgundy : colors.border }]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={18} color={input.trim() && !loading ? colors.gold : colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Limit warning bar */}
          {!isPremiumUser && used >= FREE_LIMIT - 2 && used < FREE_LIMIT && (
            <View style={[s.limitBar, { backgroundColor: colors.warningBg }]}>
              <Ionicons name="warning-outline" size={13} color={colors.warning} />
              <Text style={[s.limitBarText, { color: colors.warning }]}>
                {FREE_LIMIT - used} free message{FREE_LIMIT - used !== 1 ? 's' : ''} remaining this month
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      <PaywallModal
        visible={showPaywall}
        used={used}
        onClose={() => setShowPaywall(false)}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textPrimary },
    headerSub: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 1 },
    usagePill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    },
    usageText: { fontFamily: FONTS.semibold, fontSize: 11 },
    quickRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
    quickChip: {
      borderRadius: 20, borderWidth: 1,
      paddingHorizontal: 14, paddingVertical: 9,
      flexShrink: 0, alignSelf: 'flex-start',
    },
    quickChipText: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 18 },
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 8,
      marginHorizontal: 12, marginBottom: 12, marginTop: 4,
      borderRadius: 20, borderWidth: 1,
      paddingHorizontal: 14, paddingVertical: 8,
    },
    input: {
      flex: 1, fontFamily: FONTS.regular, fontSize: 15,
      maxHeight: 100, lineHeight: 20,
    },
    sendBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    limitBar: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 16, paddingVertical: 8,
    },
    limitBarText: { fontFamily: FONTS.medium, fontSize: 12 },
  });
}
