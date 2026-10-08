import { create } from 'axios';

import { API_BASE_URL } from '@/shared/constants/config';
import { clearAccessToken, getAccessToken } from '@/shared/services/tokenStorage';
import { useAuthStore } from '@/shared/store/auth';

export const api = create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

const AUTH_PATHS = ['/auth/login', '/auth/register'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url ?? '';
    const isAuthRequest = AUTH_PATHS.some((path) => url.includes(path));
    const alreadyRetried = (error.config as { _retry?: boolean } | undefined)
      ?._retry;
    if (status === 401 && !isAuthRequest && !alreadyRetried) {
      if (error.config) {
        (error.config as { _retry?: boolean })._retry = true;
      }
      try {
        await clearAccessToken();
      } catch {
        // Best-effort: aunque falle el borrado, se expulsa la sesión en memoria.
      }
      useAuthStore.setState({ token: null });
    }
    return Promise.reject(error);
  },
);
