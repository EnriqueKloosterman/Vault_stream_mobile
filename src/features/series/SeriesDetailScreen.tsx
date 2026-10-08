import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/shared/components/state-views';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/use-theme';
import { useDownloadsStore } from '@/shared/services/download-manager';
import {
  fetchSeries,
  type Episode,
  type SeriesDetailResponse,
} from '@/shared/services/libraryApi';
import {
  fetchProgress,
  type WatchProgressEntry,
} from '@/shared/services/progressApi';
import { getApiErrorMessage } from '@/shared/utils/api-error';
import { formatTime } from '@/shared/utils/time';

type Props = { id: string };

type SeasonSection = {
  title: string;
  data: Episode[];
};

export function SeriesDetailScreen({ id }: Props) {
  const colors = useTheme();
  const [detail, setDetail] = useState<SeriesDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressByRef, setProgressByRef] = useState<
    Record<string, WatchProgressEntry>
  >({});
  const [episodeDownloads, setEpisodeDownloads] = useState<
    Record<string, { state: 'idle' | 'working' | 'error'; error?: string }>
  >({});

  const startEpisodeDownload = useCallback((episodeId: string) => {
    setEpisodeDownloads((prev) => ({
      ...prev,
      [episodeId]: { state: 'working' },
    }));
    void useDownloadsStore
      .getState()
      .start('episode', episodeId)
      .then(() => {
        setEpisodeDownloads((prev) => ({
          ...prev,
          [episodeId]: { state: 'idle' },
        }));
      })
      .catch((e: unknown) => {
        setEpisodeDownloads((prev) => ({
          ...prev,
          [episodeId]: {
            state: 'error',
            error: getApiErrorMessage(e, 'No se pudo iniciar la descarga'),
          },
        }));
      });
  }, []);

  const load = useCallback(
    () =>
      fetchSeries(id)
        .then((data) => {
          setDetail(data);
          setError(null);
        })
        .catch((e: unknown) => {
          setDetail(null);
          setError(getApiErrorMessage(e, 'No se pudo cargar la serie'));
        })
        .finally(() => {
          setLoading(false);
        }),
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    fetchProgress({ itemType: 'episode' })
      .then((entries) => {
        const map: Record<string, WatchProgressEntry> = {};
        for (const entry of entries) {
          map[entry.refId] = entry;
        }
        setProgressByRef(map);
      })
      .catch(() => undefined);
  }, [id]);

  const playEpisode = useCallback(
    (episode: Episode) => {
      const entry = progressByRef[episode._id];
      const canResume = entry !== undefined && entry.currentTimeSec > 30;
      router.push({
        pathname: '/player/[id]',
        params: {
          id: episode._id,
          r2Key: episode.r2Key,
          subtitleKey: episode.subtitleKey ?? '',
          title: episode.title,
          itemType: 'episode',
          ...(canResume ? { startAt: String(entry.currentTimeSec) } : {}),
        },
      });
    },
    [progressByRef],
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <LoadingState variant="fill" />
      </ThemedView>
    );
  }

  if (error || !detail) {
    return (
      <ThemedView style={styles.container}>
        <ErrorState
          message={error ?? 'Serie no encontrada'}
          onRetry={retry}
          variant="fill"
        />
      </ThemedView>
    );
  }

  const sections: SeasonSection[] = detail.seasons
    .map((season) => ({
      title: `Temporada ${season.season}`,
      data: season.episodes,
    }))
    .filter((section) => section.data.length > 0);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: detail.series.title }} />
      <SectionList
        sections={sections}
        keyExtractor={(episode) => episode._id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState message="Esta serie no tiene episodios todavía." />
        }
        ListHeaderComponent={
          <View>
            {detail.series.backdropUrl ?? detail.series.posterUrl ? (
              <Image
                source={{
                  uri: detail.series.backdropUrl ?? detail.series.posterUrl,
                }}
                style={styles.cover}
                contentFit="cover"
                transition={200}
                cachePolicy="disk"
                accessible={false}
              />
            ) : null}
            <View style={styles.header}>
              {detail.series.synopsis ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {detail.series.synopsis}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {detail.series.year ? `${detail.series.year} · ` : ''}
                {sections.reduce((count, section) => count + section.data.length, 0)}{' '}
                episodios
              </ThemedText>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item }) => {
          const entry = progressByRef[item._id];
          const download = episodeDownloads[item._id];
          const isWorking = download?.state === 'working';
          return (
            <View style={styles.episodeWrap}>
              <Pressable
                onPress={() => playEpisode(item)}
                accessibilityRole="button"
                accessibilityHint="Reproduce el episodio"
                style={({ pressed }) => [
                  styles.episode,
                  { backgroundColor: colors.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                {item.stillUrl ? (
                  <Image
                    source={{ uri: item.stillUrl }}
                    style={styles.episodeThumb}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="disk"
                    accessible={false}
                  />
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {`E${String(item.number).padStart(2, '0')}`}
                  </ThemedText>
                )}
                <ThemedText type="small" style={styles.episodeTitle} numberOfLines={2}>
                  {item.title}
                </ThemedText>
                {entry && entry.completedPct > 0 ? (
                  entry.completedPct === 100 ? (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.textSecondary}
                      accessibilityLabel="Completado"
                    />
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {`${entry.completedPct}% · ${formatTime(entry.currentTimeSec)}`}
                    </ThemedText>
                  )
                ) : null}
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    startEpisodeDownload(item._id);
                  }}
                  disabled={isWorking}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                  accessibilityRole="button"
                  accessibilityLabel={`Descargar ${item.title}`}>
                  {isWorking ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : download?.state === 'error' ? (
                    <Ionicons name="warning-outline" size={16} color={colors.error} />
                  ) : (
                    <Ionicons
                      name="download-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                  )}
                </Pressable>
                <Ionicons
                  name="play"
                  size={14}
                  color={colors.textSecondary}
                  aria-hidden
                />
              </Pressable>
              {download?.state === 'error' && download.error ? (
                <ThemedText type="small" themeColor="error">
                  {download.error}
                </ThemedText>
              ) : null}
            </View>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.two, flexGrow: 1 },
  header: { marginBottom: Spacing.two, gap: Spacing.one },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginBottom: Spacing.three,
  },
  sectionTitle: { marginTop: Spacing.three, marginBottom: Spacing.one },
  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 10,
    padding: Spacing.threeAndHalf,
  },
  episodeThumb: { width: 96, height: 54, borderRadius: 8 },
  episodeWrap: { gap: Spacing.one },
  episodeTitle: { flex: 1 },
  pressed: { opacity: 0.6 },
});
