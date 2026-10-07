import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  Directory,
  DownloadTask,
  File,
  Paths,
  type DownloadPauseState,
  type DownloadProgress,
} from 'expo-file-system';

import {
  completeDownloadRequest,
  fetchDownloads,
  removeDownloadRequest,
  reportDownloadProgress,
  startDownloadRequest,
  type DownloadRecord,
} from '@/shared/services/downloadsApi';
import type { MediaItemType } from '@/shared/services/progressApi';
import { getApiErrorMessage } from '@/shared/utils/api-error';

const tasks = new Map<string, DownloadTask>();
const lastServerReport = new Map<string, number>();
const PAUSE_STATE_KEY = 'download.pauseState.';

async function savePauseState(downloadId: string, task: DownloadTask): Promise<void> {
  try {
    if (task.state !== 'paused') {
      return;
    }
    await AsyncStorage.setItem(
      PAUSE_STATE_KEY + downloadId,
      JSON.stringify(task.savable()),
    );
  } catch {
    // Best-effort: sin este estado la descarga no podrá reanudarse entre reinicios.
  }
}

async function loadPauseState(downloadId: string): Promise<DownloadPauseState | null> {
  try {
    const raw = await AsyncStorage.getItem(PAUSE_STATE_KEY + downloadId);
    return raw ? (JSON.parse(raw) as DownloadPauseState) : null;
  } catch {
    return null;
  }
}

async function clearPauseState(downloadId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PAUSE_STATE_KEY + downloadId);
  } catch {
    // Best-effort.
  }
}

function downloadsDirectory(): Directory {
  return new Directory(Paths.document, 'downloads');
}

function ensureDownloadsDirectory(): void {
  const directory = downloadsDirectory();
  if (!directory.exists) {
    directory.create();
  }
}

export function localFileFor(record: Pick<DownloadRecord, 'localPath'>): File {
  return new File(Paths.document, ...record.localPath.split('/'));
}

function findCompleted(
  records: DownloadRecord[],
  itemType: MediaItemType,
  refId: string,
): DownloadRecord | undefined {
  return records.find(
    (r) =>
      r.itemType === itemType &&
      r.refId === refId &&
      r.status === 'completed' &&
      Date.parse(r.expiresAt) > Date.now(),
  );
}

export async function findLocalPlaybackFile(
  itemType: MediaItemType,
  refId: string,
): Promise<string | null> {
  const cached = findCompleted(
    useDownloadsStore.getState().records,
    itemType,
    refId,
  );
  if (cached) {
    const file = localFileFor(cached);
    if (file.exists) {
      return file.uri;
    }
  }
  try {
    const record = findCompleted(await fetchDownloads(), itemType, refId);
    if (!record) {
      return null;
    }
    const file = localFileFor(record);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

type DownloadsState = {
  records: DownloadRecord[];
  activeIds: string[];
  pausedIds: string[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  init: () => Promise<void>;
  start: (itemType: MediaItemType, refId: string) => Promise<void>;
  togglePause: (downloadId: string) => Promise<void>;
  remove: (downloadId: string) => Promise<void>;
  purgeExpired: () => Promise<number>;
  setProgressLocal: (downloadId: string, progressPct: number) => void;
};

export const useDownloadsStore = create<DownloadsState>((set, get) => {
  const markInactive = (downloadId: string) => {
    set((state) => ({
      activeIds: state.activeIds.filter((id) => id !== downloadId),
      pausedIds: state.pausedIds.filter((id) => id !== downloadId),
    }));
  };

  const finishDownload = async (downloadId: string, file: File) => {
    tasks.delete(downloadId);
    lastServerReport.delete(downloadId);
    markInactive(downloadId);
    await clearPauseState(downloadId);
    try {
      await completeDownloadRequest(downloadId, file.size);
    } catch {
      // El archivo local ya existe; el estado del servidor se sincroniza al reintentar.
    }
    await get().load();
  };

  const progressHandler =
    (downloadId: string) =>
    ({ bytesWritten, totalBytes }: DownloadProgress) => {
      if (totalBytes <= 0) {
        return;
      }
      const progressPct = Math.min(99, Math.round((bytesWritten / totalBytes) * 100));
      get().setProgressLocal(downloadId, progressPct);
      const now = Date.now();
      if (now - (lastServerReport.get(downloadId) ?? 0) >= 2000) {
        lastServerReport.set(downloadId, now);
        void reportDownloadProgress(downloadId, progressPct).catch(() => undefined);
      }
    };

  const runTask = async (downloadId: string, task: DownloadTask) => {
    try {
      const file = await task.downloadAsync();
      if (file) {
        await finishDownload(downloadId, file);
      } else {
        // Pausado: guardar el estado reanudable para poder continuar más tarde.
        await savePauseState(downloadId, task);
      }
    } catch {
      tasks.delete(downloadId);
      markInactive(downloadId);
      await clearPauseState(downloadId);
    }
  };

  const resumeTask = async (downloadId: string, task: DownloadTask) => {
    try {
      const file = await task.resumeAsync();
      if (file) {
        await finishDownload(downloadId, file);
      } else {
        // Pausado de nuevo durante la reanudación.
        markInactive(downloadId);
        set((state) => ({
          pausedIds: state.pausedIds.includes(downloadId)
            ? state.pausedIds
            : [...state.pausedIds, downloadId],
        }));
        await savePauseState(downloadId, task);
      }
    } catch {
      markInactive(downloadId);
      // Los datos de reanudación ya no sirven: el siguiente intento arrancará de cero.
      await clearPauseState(downloadId);
    }
  };

  return {
    records: [],
    activeIds: [],
    pausedIds: [],
    loading: true,
    error: null,

    load: async () => {
      try {
        const records = await fetchDownloads();
        set({ records, error: null });
      } catch (e) {
        set({ error: getApiErrorMessage(e, 'No se pudieron cargar las descargas') });
      } finally {
        set({ loading: false });
      }
    },

    init: async () => {
      await get().load();
      await get().purgeExpired();
    },

    setProgressLocal: (downloadId, progressPct) => {
      set((state) => ({
        records: state.records.map((record) =>
          record._id === downloadId
            ? {
                ...record,
                progressPct,
                status:
                  record.status === 'pending' ? 'downloading' : record.status,
              }
            : record,
        ),
      }));
    },

    start: async (itemType, refId) => {
      const { downloadId, url } = await startDownloadRequest(itemType, refId);
      if (tasks.has(downloadId)) {
        return;
      }
      await clearPauseState(downloadId);
      ensureDownloadsDirectory();
      const destination = new File(Paths.document, 'downloads', `${downloadId}.mp4`);
      if (destination.exists) {
        destination.delete();
      }
      const task = File.createDownloadTask(url, destination, {
        onProgress: progressHandler(downloadId),
      });
      tasks.set(downloadId, task);
      set((state) => ({
        activeIds: state.activeIds.includes(downloadId)
          ? state.activeIds
          : [...state.activeIds, downloadId],
        pausedIds: state.pausedIds.filter((id) => id !== downloadId),
      }));
      await get().load();
      await runTask(downloadId, task);
    },

    togglePause: async (downloadId) => {
      const task = tasks.get(downloadId);
      if (!task) {
        // Reanudación entre reinicios: restaurar la tarea desde el estado persistido.
        let restored: DownloadTask | null = null;
        const saved = await loadPauseState(downloadId);
        if (saved) {
          try {
            restored = DownloadTask.fromSavable(saved, {
              onProgress: progressHandler(downloadId),
            });
          } catch {
            await clearPauseState(downloadId);
          }
        }
        if (restored) {
          tasks.set(downloadId, restored);
          set((state) => ({
            activeIds: state.activeIds.includes(downloadId)
              ? state.activeIds
              : [...state.activeIds, downloadId],
            pausedIds: state.pausedIds.filter((id) => id !== downloadId),
          }));
          await resumeTask(downloadId, restored);
          return;
        }
        // Sin estado reanudable no se puede continuar: se reinicia desde cero.
        const record = get().records.find((r) => r._id === downloadId);
        if (record && record.status !== 'completed') {
          await get().remove(downloadId);
          await get().start(record.itemType, record.refId);
        }
        return;
      }
      if (task.state === 'active') {
        task.pause();
        set((state) => ({
          activeIds: state.activeIds.filter((id) => id !== downloadId),
          pausedIds: state.pausedIds.includes(downloadId)
            ? state.pausedIds
            : [...state.pausedIds, downloadId],
        }));
        return;
      }
      if (task.state === 'paused') {
        set((state) => ({
          pausedIds: state.pausedIds.filter((id) => id !== downloadId),
          activeIds: state.activeIds.includes(downloadId)
            ? state.activeIds
            : [...state.activeIds, downloadId],
        }));
        await resumeTask(downloadId, task);
      }
    },

    remove: async (downloadId) => {
      const task = tasks.get(downloadId);
      if (task) {
        task.cancel();
        tasks.delete(downloadId);
      }
      lastServerReport.delete(downloadId);
      await clearPauseState(downloadId);
      const record = get().records.find((r) => r._id === downloadId);
      if (record) {
        try {
          const file = localFileFor(record);
          if (file.exists) {
            file.delete();
          }
        } catch {
          // El archivo puede no existir.
        }
      }
      await removeDownloadRequest(downloadId).catch(() => undefined);
      set((state) => ({
        records: state.records.filter((r) => r._id !== downloadId),
        activeIds: state.activeIds.filter((id) => id !== downloadId),
        pausedIds: state.pausedIds.filter((id) => id !== downloadId),
      }));
    },

    purgeExpired: async () => {
      const expired = get().records.filter(
        (record) => Date.parse(record.expiresAt) < Date.now(),
      );
      if (expired.length === 0) {
        return 0;
      }
      for (const record of expired) {
        try {
          const file = localFileFor(record);
          if (file.exists) {
            file.delete();
          }
        } catch {
          // El archivo puede no existir.
        }
        await removeDownloadRequest(record._id).catch(() => undefined);
      }
      const expiredIds = new Set(expired.map((record) => record._id));
      set((state) => ({
        records: state.records.filter((record) => !expiredIds.has(record._id)),
      }));
      return expired.length;
    },
  };
});
