import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 3000;

const isLoopback = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '::1';

function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) {
    return explicit;
  }

  if (Platform.OS === 'web') {
    return `http://localhost:${API_PORT}`;
  }

  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && !isLoopback(host)) {
    return `http://${host}:${API_PORT}`;
  }

  return Platform.OS === 'android'
    ? `http://10.0.2.2:${API_PORT}`
    : `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const PRESIGN_TTL_SECONDS = 600;

export const DOWNLOAD_EXPIRY_DAYS = 7;
