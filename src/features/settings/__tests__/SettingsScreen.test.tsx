import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert, ScrollView } from 'react-native';

import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { api } from '@/shared/services/api';

const mockPurgeExpired = jest.fn();
const mockLogout = jest.fn();
const mockDeleteAccount = jest.fn();

jest.mock('@/shared/services/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('@/shared/services/authApi', () => ({
  deleteAccountRequest: (...args: unknown[]) => mockDeleteAccount(...args),
}));
jest.mock('@/shared/services/download-manager', () => ({
  useDownloadsStore: {
    getState: () => ({ purgeExpired: mockPurgeExpired }),
  },
}));
jest.mock('@/shared/store/auth', () => ({
  useAuthStore: (selector: (state: { logout: unknown }) => unknown) =>
    selector({ logout: mockLogout }),
}));

const mockApiGet = api.get as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockApiGet.mockResolvedValue({ data: { id: 'u1', email: 'user@test.com' } });
  mockPurgeExpired.mockResolvedValue(0);
  mockLogout.mockResolvedValue(undefined);
  mockDeleteAccount.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SettingsScreen — perfil', () => {
  it('un fallo del perfil ofrece Reintentar accesible', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network Error'));

    render(<SettingsScreen />);

    expect(await screen.findByText('No se pudo cargar el perfil')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('user@test.com')).toBeOnTheScreen();
  });
});

describe('SettingsScreen — purga de descargas', () => {
  it('informa honestamente cuando no había nada que purgar', async () => {
    render(<SettingsScreen />);
    await screen.findByText('user@test.com');

    fireEvent.press(screen.getByRole('button', { name: 'Purgar descargas expiradas' }));

    expect(await screen.findByText('No había descargas expiradas')).toBeOnTheScreen();

    mockPurgeExpired.mockResolvedValue(2);
    fireEvent.press(screen.getByRole('button', { name: 'Purgar descargas expiradas' }));

    expect(await screen.findByText('Descargas expiradas purgadas')).toBeOnTheScreen();
    expect(mockPurgeExpired).toHaveBeenCalledTimes(2);
  });
});

describe('SettingsScreen — cierre de sesión', () => {
  it('pide confirmación antes de cerrar la sesión', async () => {
    render(<SettingsScreen />);
    await screen.findByText('user@test.com');

    fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2] ?? [];
    act(() => {
      buttons.find((button) => button.text === 'Cancelar')?.onPress?.();
    });
    expect(mockLogout).not.toHaveBeenCalled();

    act(() => {
      buttons.find((button) => button.text === 'Cerrar sesión')?.onPress?.();
    });
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});

describe('SettingsScreen — borrado de cuenta', () => {
  it('elimina la cuenta y cierra la sesión tras confirmar', async () => {
    render(<SettingsScreen />);
    await screen.findByText('user@test.com');

    fireEvent.press(screen.getByRole('button', { name: 'Eliminar cuenta' }));

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).not.toHaveBeenCalled();

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2] ?? [];
    act(() => {
      buttons.find((button) => button.text === 'Eliminar cuenta')?.onPress?.();
    });

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});

describe('SettingsScreen — layout', () => {
  it('el contenido vive en un ScrollView para pantallas pequeñas', async () => {
    render(<SettingsScreen />);
    await screen.findByText('user@test.com');

    expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
  });
});
