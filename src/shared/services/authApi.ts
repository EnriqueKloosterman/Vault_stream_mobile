import { api } from '@/shared/services/api';

export type AuthTokenResponse = { access_token: string };

export async function loginRequest(
  email: string,
  password: string,
): Promise<string> {
  const { data } = await api.post<AuthTokenResponse>('/auth/login', {
    email,
    password,
  });
  return data.access_token;
}

export async function registerRequest(
  email: string,
  password: string,
): Promise<string> {
  const { data } = await api.post<AuthTokenResponse>('/auth/register', {
    email,
    password,
  });
  return data.access_token;
}
