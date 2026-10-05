import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
