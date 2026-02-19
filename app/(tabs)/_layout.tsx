import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';

/**
 * Renders the main tab navigation layout for the application.
 * 
 * Provides three primary navigation sections:
 * - Dynamic Day: For tracking lines for dynamic day events
 * - Endurance: For endurance-based exercises
 * - Settings: For application configuration
 * 
 * @returns {JSX.Element} A Tabs component configured with custom styling and tab screens
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,        
        tabBarStyle: { backgroundColor: '#0b0b0c', borderTopColor: '#30363d' },
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="dynamic"
        options={{
          title: 'Dynamic Day',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="endurance"
        options={{
          title: 'Endurance',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="code-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
