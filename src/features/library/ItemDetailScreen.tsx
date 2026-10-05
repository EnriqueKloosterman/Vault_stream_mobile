import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useTheme } from '@/shared/hooks/use-theme';
import { fetchLibraryItem, type LibraryItem } from '@/shared/services/libraryApi';
import { getApiErrorMessage } from '@/shared/utils/api-error';

type Props = { id: string };

function formatSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) {
    return null;
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ItemDetailScreen({ id }: Props) {
  const colors = useTheme();
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchLibraryItem(id)
        .then((data) => {
          setItem(data);
          setError(null);
        })
        .catch((e: unknown) => {
          setItem(null);
          setError(getApiErrorMessage(e, 'No se pudo cargar el contenido'));
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

  const play = useCallback(() => {
    if (!item) {
      return;
    }
    router.push({
      pathname: '/player/[id]',
      params: {
        id: item._id,
        r2Key: item.r2Key,
        subtitleKey: item.subtitleKey ?? '',
        title: item.title,
      },
    });
  }, [item]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator style={styles.centered} color={colors.textSecondary} />
      </ThemedView>
    );
  }

  if (error || !item) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="small" themeColor="error">
            {error ?? 'Contenido no encontrado'}
          </ThemedText>
          <Pressable onPress={retry} style={styles.retry}>
            <ThemedText type="link">Reintentar</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const size = formatSize(item.fileSize);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle" numberOfLines={3}>
          {item.title}
        </ThemedText>
        <View style={styles.meta}>
          <ThemedText type="small" themeColor="textSecondary">
            Película{item.year ? ` · ${item.year}` : ''}
          </ThemedText>
          {size ? (
            <ThemedText type="small" themeColor="textSecondary">
              {size}
            </ThemedText>
          ) : null}
          {item.folderPath ? (
            <ThemedText type="code" themeColor="textSecondary">
              {item.folderPath}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {item.subtitleKey ? 'Con subtítulos disponibles' : 'Sin subtítulos'}
          </ThemedText>
        </View>
        <Pressable
          onPress={play}
          style={[styles.playButton, { backgroundColor: colors.backgroundSelected }]}>
          <ThemedText type="smallBold">▶ Reproducir</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  meta: { gap: 4 },
  playButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  retry: { paddingVertical: 8, paddingHorizontal: 12 },
});
