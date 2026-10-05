import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { useAuthStore } from '@/shared/store/auth';
import { useProgressQueueStore } from '@/shared/store/progress-queue';
import { useDownloadsStore } from '@/shared/services/download-manager';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token) {
      void useDownloadsStore.getState().init();
    }
  }, [token]);

  useEffect(() => {
    void useProgressQueueStore.getState().flush();
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void useProgressQueueStore.getState().flush();
      }
    });
    return unsubscribe;
  }, []);

  if (!hydrated) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: 'Iniciar sesión' }} />
        <Stack.Screen name="auth/register" options={{ title: 'Registro' }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Detalle' }} />
        <Stack.Screen name="series/[id]" options={{ title: 'Serie' }} />
        <Stack.Screen
          name="player/[id]"
          options={{ headerShown: false, orientation: 'landscape' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
