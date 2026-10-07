import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DownloadsScreen } from '@/features/downloads/DownloadsScreen';
import { useDownloadsStore } from '@/shared/services/download-manager';
import {
  fetchDownloads,
  removeDownloadRequest,
  type DownloadRecord,
} from '@/shared/services/downloadsApi';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    exists = true;
    constructor(...args: unknown[]) {
      this.uri = String(args[0] ?? '');
    }
    create() {
      this.exists = true;
    }
  }
  class MockFile {
    uri: string;
    exists = false;
    size = 0;
    constructor(...args: unknown[]) {
      this.uri = String(args[0] ?? '');
    }
    delete() {
      this.exists = false;
    }
    static createDownloadTask = jest.fn();
  }
  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: 'document://', cache: 'cache://' },
    DownloadTask: { fromSavable: jest.fn() },
  };
});
jest.mock('@/shared/services/downloadsApi', () => ({
  fetchDownloads: jest.fn(),
  startDownloadRequest: jest.fn(),
  reportDownloadProgress: jest.fn(),
  completeDownloadRequest: jest.fn(),
  removeDownloadRequest: jest.fn(),
}));

const record: DownloadRecord = {
  _id: 'dl1',
  itemType: 'movie',
  refId: '1',
  localPath: 'downloads/dl1.mp4',
  r2Key: 'videos/pelicula.mp4',
  status: 'pending',
  progressPct: 40,
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(fetchDownloads).mockResolvedValue([record]);
  jest.mocked(removeDownloadRequest).mockResolvedValue(true);
  useDownloadsStore.setState({
    records: [],
    activeIds: [],
    pausedIds: [],
    loading: true,
    error: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DownloadsScreen — borrar descarga', () => {
  it('pide confirmación y solo elimina si el usuario acepta', async () => {
    render(<DownloadsScreen />);

    expect(await screen.findByText('pelicula')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Eliminar descarga' }));

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(removeDownloadRequest).not.toHaveBeenCalled();

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2] ?? [];
    const cancel = buttons.find((button) => button.text === 'Cancelar');
    cancel?.onPress?.();
    expect(removeDownloadRequest).not.toHaveBeenCalled();

    const confirm = buttons.find((button) => button.text === 'Eliminar');
    expect(confirm?.style).toBe('destructive');
    confirm?.onPress?.();

    await waitFor(() => {
      expect(removeDownloadRequest).toHaveBeenCalledWith('dl1');
    });
  });
});
