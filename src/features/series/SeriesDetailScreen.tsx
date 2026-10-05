import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
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
        <ActivityIndicator style={styles.centered} color={colors.textSecondary} />
      </ThemedView>
    );
  }

  if (error || !detail) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="small" themeColor="error">
            {error ?? 'Serie no encontrada'}
          </ThemedText>
          <Pressable onPress={retry} style={styles.retry}>
            <ThemedText type="link">Reintentar</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const sections: SeasonSection[] = detail.seasons.map((season) => ({
    title: `Temporada ${season.season}`,
    data: season.episodes,
  }));

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(episode) => episode._id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle">{detail.series.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {detail.series.year ? `${detail.series.year} · ` : ''}
              {sections.reduce((count, section) => count + section.data.length, 0)}{' '}
              episodios
            </ThemedText>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item }) => {
          const entry = progressByRef[item._id];
          return (
            <Pressable
              onPress={() => playEpisode(item)}
              style={[styles.episode, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText type="code" themeColor="textSecondary">
                E{String(item.number).padStart(2, '0')}
              </ThemedText>
              <ThemedText type="small" style={styles.episodeTitle} numberOfLines={2}>
                {item.title}
              </ThemedText>
              {entry && entry.completedPct > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {entry.completedPct === 100
                    ? '✓'
                    : `${entry.completedPct}% · ${formatTime(entry.currentTimeSec)}`}
                </ThemedText>
              ) : null}
              <Pressable
                onPress={() => {
                  void useDownloadsStore.getState().start('episode', item._id);
                }}
                hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  ⬇
                </ThemedText>
              </Pressable>
              <ThemedText type="small" themeColor="textSecondary">
                ▶
              </ThemedText>
            </Pressable>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  header: { marginBottom: 8, gap: 4 },
  sectionTitle: { marginTop: 12, marginBottom: 4 },
  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    padding: 14,
  },
  episodeTitle: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  retry: { paddingVertical: 8, paddingHorizontal: 12 },
});
