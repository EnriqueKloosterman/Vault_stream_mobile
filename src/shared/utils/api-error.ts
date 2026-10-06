import { isAxiosError } from 'axios';

type ApiErrorBody = { message?: string | string[]; error?: string };

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Datos inválidos',
  401: 'Credenciales inválidas',
  409: 'El email ya está registrado',
  429: 'Demasiados intentos, espera un momento',
  500: 'Error interno del servidor',
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) {
    console.warn('[api] Error no-Axios', error);
    return fallback;
  }

  const { response, request, code, message } = error;

  if (!response) {
    console.warn('[api] Sin respuesta del servidor', {
      url: request?.url,
      method: request?.method,
      code,
      message,
    });
    return code === 'ECONNABORTED'
      ? 'El servidor tardó demasiado en responder'
      : 'No se pudo conectar con el servidor';
  }

  const body = response.data as ApiErrorBody | undefined;
  const serverMessage = body?.message;
  const resolved = Array.isArray(serverMessage)
    ? serverMessage[0]
    : typeof serverMessage === 'string' && serverMessage.length > 0
      ? serverMessage
      : undefined;

  if (resolved) {
    return resolved;
  }

  const statusMessage = STATUS_MESSAGES[response.status];

  console.warn('[api] Respuesta sin mensaje utilizable', {
    status: response.status,
    url: request?.url,
    body,
  });

  return statusMessage ?? `${fallback} (HTTP ${response.status})`;
}
