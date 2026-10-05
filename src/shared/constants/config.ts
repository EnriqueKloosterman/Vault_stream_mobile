import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEV_HOST;

export const PRESIGN_TTL_SECONDS = 600;

export const DOWNLOAD_EXPIRY_DAYS = 7;
