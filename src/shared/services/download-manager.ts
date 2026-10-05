import { create } from 'zustand';
import { Directory, File, Paths, type DownloadTask } from 'expo-file-system';

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
  purgeExpired: () => Promise<void>;
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
    try {
      await completeDownloadRequest(downloadId, file.size);
    } catch {
      // El archivo local ya existe; el estado del servidor se sincroniza al reintentar.
    }
    await get().load();
  };

  const runTask = async (downloadId: string, task: DownloadTask) => {
    try {
      const file = await task.downloadAsync();
      if (file) {
        await finishDownload(downloadId, file);
      }
    } catch {
      tasks.delete(downloadId);
      markInactive(downloadId);
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
      ensureDownloadsDirectory();
      const destination = new File(Paths.document, 'downloads', `${downloadId}.mp4`);
      if (destination.exists) {
        destination.delete();
      }
      const task = File.createDownloadTask(url, destination, {
        onProgress: ({ bytesWritten, totalBytes }) => {
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
        },
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
          }
        } catch {
          markInactive(downloadId);
        }
      }
    },

    remove: async (downloadId) => {
      const task = tasks.get(downloadId);
      if (task) {
        task.cancel();
        tasks.delete(downloadId);
      }
      lastServerReport.delete(downloadId);
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
        return;
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
    },
  };
});
