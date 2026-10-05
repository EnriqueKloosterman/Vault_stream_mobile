import { api } from '@/shared/services/api';

export type MediaItemType = 'movie' | 'episode';

export type ProgressUpdate = {
  itemType: MediaItemType;
  refId: string;
  currentTimeSec: number;
  durationSec: number;
  completedPct: number;
  lastUpdated: number;
};

export type WatchProgressEntry = ProgressUpdate & { _id: string };

export async function fetchProgress(params?: {
  itemType?: MediaItemType;
  refId?: string;
}): Promise<WatchProgressEntry[]> {
  const { data } = await api.get<WatchProgressEntry[]>('/progress', { params });
  return data;
}

export async function sendProgress(
  updates: ProgressUpdate[],
): Promise<{ updated: number; skipped: number }> {
  const { data } = await api.post<{ updated: number; skipped: number }>(
    '/progress',
    { updates },
  );
  return data;
}
