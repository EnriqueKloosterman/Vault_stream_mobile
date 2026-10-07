import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadTask, File } from 'expo-file-system';

import { useDownloadsStore } from '@/shared/services/download-manager';
import {
  completeDownloadRequest,
  fetchDownloads,
  removeDownloadRequest,
  startDownloadRequest,
  type DownloadRecord,
} from '@/shared/services/downloadsApi';

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

const PAUSE_STATE_KEY = 'download.pauseState.';

const makeRecord = (overrides: Partial<DownloadRecord>): DownloadRecord => ({
  _id: 'dl1',
  itemType: 'movie',
  refId: '1',
  localPath: 'downloads/dl1.mp4',
  r2Key: 'videos/pelicula.mp4',
  status: 'pending',
  progressPct: 40,
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  ...overrides,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useDownloadsStore.setState({
    records: [],
    activeIds: [],
    pausedIds: [],
    loading: false,
    error: null,
  });
  jest.mocked(fetchDownloads).mockResolvedValue([]);
  jest.mocked(removeDownloadRequest).mockResolvedValue(true);
});

describe('togglePause', () => {
  it('reanuda desde el estado persistido sin destruir la descarga', async () => {
    const record = makeRecord({});
    useDownloadsStore.setState({ records: [record] });
    const saved = {
      url: 'https://cdn/video',
      fileUri: 'document://downloads/dl1.mp4',
      isDirectory: false,
      resumeData: 'ABC',
    };
    await AsyncStorage.setItem(PAUSE_STATE_KEY + 'dl1', JSON.stringify(saved));

    const restoredTask = {
      state: 'paused',
      resumeAsync: jest.fn().mockResolvedValue(null),
      savable: jest.fn(() => ({ ...saved, resumeData: 'XYZ' })),
    };
    jest.mocked(DownloadTask.fromSavable).mockReturnValue(restoredTask as never);

    await useDownloadsStore.getState().togglePause('dl1');

    expect(DownloadTask.fromSavable).toHaveBeenCalledWith(
      saved,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    expect(removeDownloadRequest).not.toHaveBeenCalled();
    expect(startDownloadRequest).not.toHaveBeenCalled();
    expect(completeDownloadRequest).not.toHaveBeenCalled();
    expect(useDownloadsStore.getState().records).toEqual([record]);
    expect(useDownloadsStore.getState().activeIds).not.toContain('dl1');
    expect(useDownloadsStore.getState().pausedIds).toContain('dl1');
    const persisted = await AsyncStorage.getItem(PAUSE_STATE_KEY + 'dl1');
    expect(JSON.parse(persisted ?? 'null')).toEqual({ ...saved, resumeData: 'XYZ' });
  });

  it('sin estado reanudable reinicia la descarga desde cero', async () => {
    const record = makeRecord({ _id: 'dl2', refId: 'ref-2', progressPct: 60 });
    useDownloadsStore.setState({ records: [record] });
    jest.mocked(startDownloadRequest).mockResolvedValue({
      downloadId: 'dl9',
      url: 'https://cdn/new',
      expiresIn: 300,
      fileName: 'dl9.mp4',
    });

    await useDownloadsStore.getState().togglePause('dl2');

    expect(DownloadTask.fromSavable).not.toHaveBeenCalled();
    expect(removeDownloadRequest).toHaveBeenCalledWith('dl2');
    expect(startDownloadRequest).toHaveBeenCalledWith('movie', 'ref-2');
    expect(File.createDownloadTask).toHaveBeenCalled();
  });
});
