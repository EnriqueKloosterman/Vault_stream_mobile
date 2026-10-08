import { create } from 'zustand';

import { clearAccessToken, getAccessToken, setAccessToken } from '@/shared/services/tokenStorage';

type AuthState = {
  token: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  hydrated: false,
  hydrate: async () => {
    const token = await getAccessToken();
    set({ token, hydrated: true });
  },
  login: async (token: string) => {
    await setAccessToken(token);
    set({ token });
  },
  logout: async () => {
    try {
      await clearAccessToken();
    } finally {
      set({ token: null });
    }
  },
}));
