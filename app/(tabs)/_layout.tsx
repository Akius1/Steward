import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Clean tab icon: solid filled icon when active + gold dot indicator below.
// No pill — avoids clipping the icon and the "straight lines" artifact.
function TabIcon({ name, color, focused }: { name: IoniconName; color: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Ionicons name={name} size={22} color={color} />
      {focused && (
        <View style={{
          width: 4, height: 4, borderRadius: 2,
          backgroundColor: color,
        }} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const activeTint   = isDark ? colors.gold : colors.burgundy;
  const inactiveTint = isDark ? 'rgba(255,255,255,0.38)' : colors.textMuted;

  // Tab bar height = visible content (56px) + device home-indicator space
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? colors.burgundyNav : colors.card,
          borderTopWidth: isDark ? 0 : 1,
          borderTopColor: colors.borderLight,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
          shadowColor: isDark ? 'transparent' : colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0 : 0.08,
          shadowRadius: 16,
          elevation: isDark ? 0 : 8,
        },
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarLabelStyle: {
          fontFamily: FONTS.medium,
          fontSize: 11,
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Income',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'cash' : 'cash-outline'}
              color={color}
              focused={focused}
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
              name={focused ? 'pie-chart' : 'pie-chart-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'flag' : 'flag-outline'}
              color={color}
              focused={focused}
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
            />
          ),
        }}
      />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
