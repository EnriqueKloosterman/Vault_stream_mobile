import { api } from '@/shared/services/api';

export type ItemType = 'movie' | 'series';

export type LibraryItem = {
  _id: string;
  type: ItemType;
  title: string;
  year?: number;
  posterUrl?: string;
  backdropUrl?: string;
  r2Key: string;
  seriesId?: string;
  folderPath?: string;
  subtitleKey?: string;
  fileSize?: number;
  watched: boolean;
};

export type LibraryListResponse = {
  items: LibraryItem[];
  total: number;
  page: number;
  limit: number;
};

export type Episode = {
  _id: string;
  title: string;
  number: number;
  r2Key: string;
  subtitleKey?: string;
  seasonId: string;
  seriesId: string;
  watched?: boolean;
  stillUrl?: string;
};

export type SeriesDetailResponse = {
  series: {
    _id: string;
    title: string;
    year?: number;
    posterUrl?: string;
    backdropUrl?: string;
    synopsis?: string;
  };
  seasons: { season: number; episodes: Episode[] }[];
};

export type PresignResponse = { url: string; expiresIn: number };

export type LibraryQuery = {
  page?: number;
  limit?: number;
  type?: ItemType;
  q?: string;
  signal?: AbortSignal;
};

export async function fetchLibrary(query: LibraryQuery = {}): Promise<LibraryListResponse> {
  const { signal, ...params } = query;
  const { data } = await api.get<LibraryListResponse>('/library', { params, signal });
  return data;
}

export async function fetchLibraryItem(id: string): Promise<LibraryItem> {
  const { data } = await api.get<LibraryItem>(`/library/${id}`);
  return data;
}

export async function fetchSeries(id: string): Promise<SeriesDetailResponse> {
  const { data } = await api.get<SeriesDetailResponse>(`/series/${id}`);
  return data;
}

export async function presignVideo(r2Key: string): Promise<PresignResponse> {
  const { data } = await api.post<PresignResponse>('/media/presign', { r2Key });
  return data;
}

export async function presignSubtitle(subtitleKey: string): Promise<PresignResponse> {
  const { data } = await api.get<PresignResponse>('/media/subtitle', {
    params: { subtitleKey },
  });
  return data;
}
