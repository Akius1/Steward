import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Easing,
  StyleSheet, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, default 3500
}

const SCREEN_W = Dimensions.get('window').width;

const TOAST_META: Record<ToastType, {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
}> = {
  success: { icon: 'checkmark-circle', color: '#10B97A', bg: '#10B97A18' },
  error:   { icon: 'close-circle',     color: '#EF4444', bg: '#EF444418' },
  warning: { icon: 'alert-circle',     color: '#F59E0B', bg: '#F59E0B18' },
  info:    { icon: 'information-circle', color: '#D4AF37', bg: '#D4AF3718' },
};

// ─── Single Toast banner ──────────────────────────────────────────────────────
interface ToastBannerProps {
  config: ToastConfig;
  onDismiss: () => void;
}

export function ToastBanner({ config, onDismiss }: ToastBannerProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const meta = TOAST_META[config.type];
  const duration = config.duration ?? 3500;

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const progress   = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,    duration: 220, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [onDismiss]);

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Progress bar drains over `duration`
    Animated.timing(progress, {
      toValue: 0, duration, easing: Easing.linear, useNativeDriver: false,
    }).start();

    dismissTimer.current = setTimeout(dismiss, duration);
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, []);

  const progressBarColor = meta.color;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 10,
          opacity,
          transform: [{ translateY }],
          backgroundColor: isDark ? colors.card : '#FFFFFF',
          borderColor: meta.color + '30',
          shadowColor: meta.color,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.inner}
        onPress={dismiss}
        activeOpacity={0.95}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: meta.color }]} />

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={22} color={meta.color} />
        </View>

        {/* Text */}
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {config.title}
          </Text>
          {config.message ? (
            <Text style={[styles.message, { color: colors.textMuted }]} numberOfLines={2}>
              {config.message}
            </Text>
          ) : null}
        </View>

        {/* Dismiss × */}
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Countdown bar */}
      <Animated.View
        style={[
          styles.progressBar,
          {
            backgroundColor: progressBarColor,
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </Animated.View>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
interface ToastState {
  id: number;
  config: ToastConfig;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((config: ToastConfig) => {
    idRef.current += 1;
    setToast({ id: idRef.current, config });
  }, []);

  const ToastElement = toast ? (
    <ToastBanner
      key={toast.id}
      config={toast.config}
      onDismiss={() => setToast(null)}
    />
  ) : null;

  return { showToast, ToastElement };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 14,
    gap: 12,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginLeft: 4,
    marginVertical: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    marginBottom: 2,
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  closeBtn: {
    padding: 4,
    flexShrink: 0,
  },
  progressBar: {
    height: 3,
    borderRadius: 0,
  },
});
