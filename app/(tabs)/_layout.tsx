import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color }: { name: IoniconName; color: string }) {
  return <Ionicons name={name} size={24} color={color} />;
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: FONTS.medium,
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Income',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'cash' : 'cash-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="allocate"
        options={{
          title: 'Allocate',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'pie-chart' : 'pie-chart-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Report',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
