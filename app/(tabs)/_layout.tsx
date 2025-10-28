import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Tabs } from 'expo-router';
import React from 'react';

const palette = {
  bg: '#0b0b0c',
  active: '#238636',
  dim: '#c9d1d9',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: { backgroundColor: palette.bg, height: 64, paddingVertical: 8, borderTopColor: '#222' },
        tabBarActiveTintColor: palette.active,
        tabBarInactiveTintColor: palette.dim,
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="dynamic"
        options={{
          title: 'Dynamic Day',
          tabBarIcon: ({ color }) => <IconSymbol name="paperplane.fill" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="endurance"
        options={{
          title: 'Endurance',
          tabBarIcon: ({ color }) => <IconSymbol name="house.fill" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <IconSymbol name="chevron.left.forwardslash.chevron.right" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
