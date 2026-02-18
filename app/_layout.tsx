import { Stack, Redirect } from 'expo-router';
import { OnlineProvider } from '@/offline/OnlineProvider';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerServiceWorker } from '@/web/register-sw';

/**
 * Root layout component that serves as the main wrapper for the application.
 * 
 * Registers a service worker on web platforms and provides online status context
 * to all child routes through the OnlineProvider.
 * 
 * @returns {JSX.Element} The root layout structure with navigation stack and context providers
 */
export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      registerServiceWorker?.();
    }
  }, []);

  return (
    <OnlineProvider>
      <Stack screenOptions={{ headerShown: false }}> 
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </OnlineProvider>
  );
}
