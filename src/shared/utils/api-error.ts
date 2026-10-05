import { isAxiosError } from 'axios';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return 'No se pudo conectar con el servidor';
    }
    const body = error.response.data as { message?: string | string[] } | undefined;
    const message = body?.message;
    if (Array.isArray(message)) {
      return message[0] ?? fallback;
    }
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    if (error.response.status === 401) {
      return 'Credenciales inválidas';
    }
    if (error.response.status === 409) {
      return 'El email ya está registrado';
    }
  }
  return fallback;
}
