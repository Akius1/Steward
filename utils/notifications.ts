import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PREF_KEY = 'steward_notifications_enabled';
const IS_NATIVE = Platform.OS !== 'web';

// Safe SecureStore wrappers — expo-secure-store has no web implementation
const store = {
  get: (key: string) => IS_NATIVE ? SecureStore.getItemAsync(key).catch(() => null) : Promise.resolve(null),
  set: (key: string, val: string) => IS_NATIVE ? SecureStore.setItemAsync(key, val).catch(() => {}) : Promise.resolve(),
};

// We only use LOCAL scheduled notifications — disable remote push token
// auto-registration so Expo Go (SDK 53+) doesn't throw a console error.
if (IS_NATIVE) {
  (Notifications as any).setAutoServerRegistrationEnabledAsync?.(false).catch(() => {});
}

// Configure how notifications appear when app is foregrounded (native only)
if (IS_NATIVE) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    const val = await store.get(PREF_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function requestPermissionsAndEnable(): Promise<boolean> {
  try {
    // Local notifications still work in Expo Go — only remote push is restricted.
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    await store.set(PREF_KEY, 'true');
    await scheduleAllNotifications();
    return true;
  } catch {
    // Gracefully fail (e.g. simulator / Expo Go with limited support)
    return false;
  }
}

export async function disableNotifications(): Promise<void> {
  await store.set(PREF_KEY, 'false');
  if (IS_NATIVE) await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

// ─── Schedule recurring local notifications ────────────────────────────────

export async function scheduleAllNotifications(): Promise<void> {
  // Cancel existing before re-scheduling to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('steward-default', {
      name: 'Steward',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const channelId = Platform.OS === 'android' ? 'steward-default' : undefined;

  // 1. Monthly plan reminder — 1st of every month at 9 AM
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New month, new plan 📋',
      body: "Give every naira a purpose — set up this month's budget.",
      ...(channelId ? { channelId } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      day: 1,
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });

  // 2. Mid-month check-in — 15th at 8 PM
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Halfway there 📊",
      body: "Check how your actual spending compares to your budget.",
      ...(channelId ? { channelId } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      day: 15,
      hour: 20,
      minute: 0,
      repeats: true,
    },
  });

  // 3. Weekly digest — every Sunday at 8 PM
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your weekly digest is ready 📊",
      body: "See how your finances performed this week.",
      ...(channelId ? { channelId } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday (1 = Sunday in Expo's calendar)
      hour: 20,
      minute: 0,
    },
  });

  // 4. End-of-month grade report — 28th at 7 PM
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your grade is ready 🏆",
      body: "See your W.A.E.C. financial score for this month.",
      ...(channelId ? { channelId } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      day: 28,
      hour: 19,
      minute: 0,
      repeats: true,
    },
  });
}

// ─── Dynamic: overspend alert (fires immediately after a transaction) ─────────
/**
 * Fire a push notification immediately when a category crosses 80% or 100%.
 * Call this right after a transaction is saved.
 */
export async function sendOverspendAlert(
  categoryName: string,
  spentPct: number,
  spentAmount: string,
  budgetAmount: string,
): Promise<void> {
  if (!IS_NATIVE) return;
  const enabled = await getNotificationsEnabled();
  if (!enabled) return;
  try {
    const channelId = Platform.OS === 'android' ? 'steward-default' : undefined;
    const isOver = spentPct >= 100;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isOver
          ? `${categoryName} budget exceeded!`
          : `${categoryName} at ${Math.round(spentPct)}% of budget`,
        body: isOver
          ? `You've spent ${spentAmount} against a ${budgetAmount} budget. Consider adjusting.`
          : `${spentAmount} of ${budgetAmount} used — only ${100 - Math.round(spentPct)}% remaining.`,
        ...(channelId ? { channelId } : {}),
      },
      trigger: null,
    });
  } catch { /* non-critical */ }
}

/**
 * After saving a transaction, check if the changed category crossed 80%/100%
 * of its monthly budget allocation and fire an alert if so.
 *
 * @param allocations  allocations rows from Supabase
 * @param actualSpends Map of { category -> totalSpent } for current month
 * @param changedCat   The transaction category just saved
 * @param fmtFn        Currency formatter, e.g. (n) => `₦${n.toLocaleString()}`
 */
export async function checkBudgetAlerts(
  allocations: Array<{ bucket_name: string; amount: number }>,
  actualSpends: Record<string, number>,
  changedCat: string,
  fmtFn: (n: number) => string,
): Promise<void> {
  if (!IS_NATIVE) return;
  const enabled = await getNotificationsEnabled();
  if (!enabled) return;

  // Loose mapping from allocation bucket names → transaction category names
  const BUCKET_TO_CAT: Record<string, string> = {
    'Food & Groceries': 'Food',
    'Rent & Housing':   'Housing',
    'Entertainment':    'Entertainment',
    'Utilities':        'Utilities',
    'Savings':          'Savings',
    'Investments':      'Investment',
    'Emergency Fund':   'Healthcare',
    'Healthcare':       'Healthcare',
    'Transport':        'Transport',
    'Shopping':         'Shopping',
    'Education':        'Education',
  };

  for (const alloc of allocations) {
    const cat = BUCKET_TO_CAT[alloc.bucket_name] ?? alloc.bucket_name;
    if (cat.toLowerCase() !== changedCat.toLowerCase()) continue;
    const spent  = actualSpends[cat] ?? 0;
    const budget = alloc.amount;
    if (budget <= 0) continue;
    const pct = (spent / budget) * 100;
    if (pct >= 80) {
      await sendOverspendAlert(cat, pct, fmtFn(spent), fmtFn(budget));
    }
    break;
  }
}
