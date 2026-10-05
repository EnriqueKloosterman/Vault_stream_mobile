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
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearAccessToken();
      useAuthStore.setState({ token: null });
    }
    return Promise.reject(error);
  },
);
