import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'stream_app_access_token';

// expo-secure-store no tiene implementación en web (expone un objeto vacío),
// por lo que en ese entorno se usa AsyncStorage. En nativo el JWT sigue
// living en el Keystore.
const useSecureStore = Platform.OS !== 'web';

export async function getAccessToken(): Promise<string | null> {
  try {
    return useSecureStore
      ? await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
      : await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAccessToken(token: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    return;
  }
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  try {
    if (useSecureStore) {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      return;
    }
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // noop
  }
}
