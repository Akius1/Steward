import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconName;
  color: string;
  focused: boolean;
  goldBg: string;
}

function TabIcon({ name, color, focused, goldBg }: TabIconProps) {
  if (focused) {
    return (
      <View
        style={[
          styles.pill,
          { backgroundColor: goldBg },
        ]}
      >
        <Ionicons name={name} size={22} color={color} />
      </View>
    );
  }
  return <Ionicons name={name} size={22} color={color} />;
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function TabLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: isDark ? 1 : 0,
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: isDark ? 0 : 0.1,
          shadowRadius: 12,
          elevation: isDark ? 0 : 6,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: FONTS.medium,
          fontSize: 12,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Income',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'wallet' : 'wallet-outline'}
              color={color}
              focused={focused}
              goldBg={colors.goldBg}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="allocate"
        options={{
          title: 'Allocate',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'layers' : 'layers-outline'}
              color={color}
              focused={focused}
              goldBg={colors.goldBg}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Report',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              color={color}
              focused={focused}
              goldBg={colors.goldBg}
            />
          ),
        }}
      />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
