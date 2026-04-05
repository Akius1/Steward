import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS, RADII } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function AppButton({
  label, onPress, variant = 'primary',
  loading = false, disabled = false,
  style, textStyle, fullWidth = true,
  size = 'lg',
}: AppButtonProps) {
  const { colors, isDark } = useTheme();

  async function handlePress() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  const heights = { sm: 40, md: 48, lg: 54 };
  const fontSizes = { sm: 13, md: 14, lg: 15 };

  const bgColor =
    variant === 'primary' ? colors.gold :
    variant === 'danger'  ? colors.danger :
    variant === 'secondary' ? colors.surface :
    'transparent';

  const borderColor =
    variant === 'secondary' ? colors.border :
    variant === 'ghost' ? colors.gold :
    'transparent';

  const labelColor =
    variant === 'primary' ? (isDark ? colors.bg : '#FFF') :
    variant === 'danger'  ? '#FFF' :
    variant === 'ghost'   ? colors.gold :
    colors.textPrimary;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[
        s.btn,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: variant === 'secondary' || variant === 'ghost' ? 1.5 : 0,
          height: heights[size],
          opacity: disabled ? 0.5 : 1,
          // Subtle top highlight for primary buttons
          ...(variant === 'primary' ? {
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.15)',
          } : {}),
        },
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={labelColor} size="small" />
        : <Text style={[s.label, { color: labelColor, fontSize: fontSizes[size] }, textStyle]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    borderRadius: RADII.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    fontFamily: FONTS.semibold,
    letterSpacing: 0.1,
  },
});
