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
const startLocks = new Map<string, Promise<void>>();
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
  const segments = record.localPath
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');
  return new File(Paths.document, ...segments);
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
      return scanDownloadsDirectory(itemType, refId);
    }
    const file = localFileFor(record);
    if (file.exists) {
      return file.uri;
    }
    return scanDownloadsDirectory(itemType, refId);
  } catch {
    return scanDownloadsDirectory(itemType, refId);
  }
}

function scanDownloadsDirectory(
  _itemType: MediaItemType,
  refId: string,
): string | null {
  try {
    const directory = downloadsDirectory();
    if (!directory.exists) {
      return null;
    }
    // Fallback offline: si el store está vacío y no hay red, buscar por refId
    // en los ficheros ya descargados. El nombre final se resuelve tras load().
    const entries = directory.list() as unknown as (
      | string
      | { name?: string; uri?: string }
    )[];
    for (const entry of entries) {
      const name = typeof entry === 'string' ? entry : entry?.name ?? '';
      if (name.includes(refId)) {
        const file = new File(Paths.document, 'downloads', name);
        if (file.exists) {
          return file.uri;
        }
      }
    }
    return null;
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

  const markError = (downloadId: string, message: string) => {
    set((state) => ({
      records: state.records.map((record) =>
        record._id === downloadId
          ? { ...record, status: 'error' as const, error: message }
          : record,
      ),
    }));
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
    } catch (e) {
      tasks.delete(downloadId);
      lastServerReport.delete(downloadId);
      markInactive(downloadId);
      markError(downloadId, getApiErrorMessage(e, 'La descarga falló'));
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
    } catch (e) {
      tasks.delete(downloadId);
      lastServerReport.delete(downloadId);
      markInactive(downloadId);
      markError(downloadId, getApiErrorMessage(e, 'La descarga falló'));
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
      const lockKey = `${itemType}:${refId}`;
      const pending = startLocks.get(lockKey);
      if (pending) {
        await pending;
        return;
      }
      let releaseLock: () => void = () => undefined;
      const lock = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      startLocks.set(lockKey, lock);
      try {
        const existing = get().records.find(
          (r) =>
            r.itemType === itemType &&
            r.refId === refId &&
            (r.status === 'pending' || r.status === 'downloading'),
        );
        if (existing && tasks.has(existing._id)) {
          return;
        }
        const { downloadId, url } = await startDownloadRequest(itemType, refId);
        if (tasks.has(downloadId)) {
          return;
        }
        await clearPauseState(downloadId);
        ensureDownloadsDirectory();
        const destination = new File(Paths.document, 'downloads', `${downloadId}.mp4`);
        if (destination.exists) {
          try {
            destination.delete();
          } catch {
            // Si el fichero está bloqueado, se continúa: la tarea lo sobrescribe.
          }
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
      } finally {
        startLocks.delete(lockKey);
        releaseLock();
      }
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
        const task = tasks.get(record._id);
        if (task) {
          try {
            task.cancel();
          } catch {
            // Best-effort.
          }
          tasks.delete(record._id);
        }
        lastServerReport.delete(record._id);
        await clearPauseState(record._id);
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
        activeIds: state.activeIds.filter((id) => !expiredIds.has(id)),
        pausedIds: state.pausedIds.filter((id) => !expiredIds.has(id)),
      }));
      return expired.length;
    },
  };
});
