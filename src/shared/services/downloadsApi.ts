import { api } from '@/shared/services/api';
import type { MediaItemType } from '@/shared/services/progressApi';

export type DownloadRecord = {
  _id: string;
  itemType: MediaItemType;
  refId: string;
  localPath: string;
  r2Key: string;
  fileSize?: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progressPct: number;
  error?: string;
  expiresAt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StartDownloadResponse = {
  downloadId: string;
  url: string;
  expiresIn: number;
  fileName: string;
  fileSize?: number;
};

export async function fetchDownloads(): Promise<DownloadRecord[]> {
  const { data } = await api.get<DownloadRecord[]>('/downloads');
  return data;
}

export async function startDownloadRequest(
  itemType: MediaItemType,
  refId: string,
): Promise<StartDownloadResponse> {
  const { data } = await api.post<StartDownloadResponse>('/downloads/start', {
    itemType,
    refId,
  });
  return data;
}

export async function reportDownloadProgress(
  downloadId: string,
  progressPct: number,
): Promise<void> {
  await api.patch(`/downloads/${downloadId}/progress`, { progressPct });
}

export async function completeDownloadRequest(
  downloadId: string,
  fileSize?: number,
): Promise<void> {
  await api.patch(`/downloads/${downloadId}/complete`, { fileSize });
}

export async function removeDownloadRequest(downloadId: string): Promise<boolean> {
  const { data } = await api.delete<{ deleted: boolean }>(
    `/downloads/${downloadId}`,
  );
  return data.deleted;
}
