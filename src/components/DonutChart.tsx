import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { FONTS } from '@/constants/theme';

export interface DonutSegment {
  value: number;
  color: string;
  label?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
  colors: any;
  style?: ViewStyle;
}

export default function DonutChart({
  segments,
  size = 140,
  strokeWidth = 20,
  centerLabel,
  centerSub,
  colors,
  style,
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let cumulativeAngle = 0;

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size}>
        {/* Track ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={colors.border}
          strokeWidth={strokeWidth}
        />

        {total > 0 &&
          segments.map((seg, i) => {
            const pct = seg.value / total;
            // 1.5px visual gap between segments
            const dashLength = Math.max(pct * circumference - 1.5, 0);
            const startAngle = -90 + cumulativeAngle * 360;
            cumulativeAngle += pct;

            if (dashLength <= 0) return null;

            return (
              <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeLinecap="butt"
                // @ts-ignore — SVG transform prop
                transform={`rotate(${startAngle} ${cx} ${cy})`}
              />
            );
          })}
      </Svg>

      {/* Centre overlay */}
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {centerLabel !== undefined && (
          <Text
            style={{
              fontFamily: FONTS.headingItalic,
              fontSize: 20,
              color: colors.textPrimary,
              lineHeight: 24,
            }}
          >
            {centerLabel}
          </Text>
        )}
        {centerSub !== undefined && (
          <Text
            style={{
              fontFamily: FONTS.medium,
              fontSize: 9,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginTop: 1,
            }}
          >
            {centerSub}
          </Text>
        )}
      </View>
    </View>
  );
}
