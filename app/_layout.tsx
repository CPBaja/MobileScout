import { Stack, Redirect } from 'expo-router';
import { OnlineProvider } from '@/offline/OnlineProvider';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerServiceWorker } from '@/web/register-sw';

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
