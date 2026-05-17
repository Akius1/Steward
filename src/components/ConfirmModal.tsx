import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  Animated, Easing, StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

const SCREEN_H = Dimensions.get('window').height;

interface ConfirmModalProps {
  visible: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible, icon = 'trash-outline', iconColor,
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  const { colors, isDark } = useTheme();

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate  = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(sheetTranslate, { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetTranslate, { toValue: 300, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const accentColor = iconColor ?? (destructive ? '#EF4444' : colors.gold);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropOpacity }]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onCancel} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: isDark ? colors.card : '#FFFFFF',
            borderColor: colors.border,
            transform: [{ translateY: sheetTranslate }],
          },
        ]}
      >
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Icon badge */}
        <View style={[styles.iconCircle, { backgroundColor: accentColor + '18' }]}>
          <Ionicons name={icon} size={28} color={accentColor} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>

        {/* Message */}
        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

        {/* Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{cancelLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn, styles.confirmBtn,
              { backgroundColor: destructive ? '#EF4444' : colors.gold },
            ]}
            onPress={onConfirm}
            activeOpacity={0.85}
          >
            <Ionicons
              name={destructive ? 'trash-outline' : 'checkmark'}
              size={16}
              color={destructive ? '#FFF' : (isDark ? colors.bg : '#FFF')}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.confirmBtnText, { color: destructive ? '#FFF' : (isDark ? colors.bg : '#FFF') }]}>
              {confirmLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, marginBottom: 24,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelBtn: {
    borderWidth: 1.5,
  },
  confirmBtn: {},
  cancelBtnText: {
    fontFamily: FONTS.semibold, fontSize: 14,
  },
  confirmBtnText: {
    fontFamily: FONTS.semibold, fontSize: 14,
  },
});
