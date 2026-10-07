import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/shared/components/progress-bar';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/state-views';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { MaxContentWidth, Spacing } from '@/shared/constants/theme';
import { useDownloadsStore } from '@/shared/services/download-manager';
import type { DownloadRecord } from '@/shared/services/downloadsApi';
import { useTheme } from '@/shared/hooks/use-theme';

function displayName(r2Key: string): string {
  const base = r2Key.split('/').pop() ?? r2Key;
  return base.replace(/\.[^.]+$/, '');
}

function statusLabel(
  record: DownloadRecord,
  isActive: boolean,
  isPaused: boolean,
): string {
  if (isActive) {
    return `Descargando ${record.progressPct}%`;
  }
  if (isPaused) {
    return `En pausa ${record.progressPct}%`;
  }
  if (record.status === 'completed') {
    return 'Completada';
  }
  if (record.status === 'error') {
    return 'Error — reintentar';
  }
  if (record.progressPct > 0) {
    return `Interrumpida ${record.progressPct}%`;
  }
  return 'Pendiente';
}

export function DownloadsScreen() {
  const colors = useTheme();
  const records = useDownloadsStore((s) => s.records);
  const activeIds = useDownloadsStore((s) => s.activeIds);
  const pausedIds = useDownloadsStore((s) => s.pausedIds);
  const loading = useDownloadsStore((s) => s.loading);
  const error = useDownloadsStore((s) => s.error);
  const init = useDownloadsStore((s) => s.init);
  const load = useDownloadsStore((s) => s.load);
  const togglePause = useDownloadsStore((s) => s.togglePause);
  const remove = useDownloadsStore((s) => s.remove);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => {
      setRefreshing(false);
    });
  }, [load]);

  const confirmRemove = (record: DownloadRecord) => {
    Alert.alert(
      'Eliminar descarga',
      `Se borrará "${displayName(record.r2Key)}" de este dispositivo. Podrás volver a descargarlo desde la biblioteca.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void remove(record._id).catch(() => undefined);
          },
        },
      ],
    );
  };

  const play = (record: DownloadRecord) => {
    router.push({
      pathname: '/player/[id]',
      params: {
        id: record.refId,
        itemType: record.itemType,
        r2Key: record.r2Key,
        title: displayName(record.r2Key),
      },
    });
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={records}
        keyExtractor={(record) => record._id}
        contentContainerStyle={[styles.list, records.length === 0 && styles.listEmpty]}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="small" themeColor="textSecondary">
              Disponibles sin conexión durante 7 días.
            </ThemedText>
            {error && records.length > 0 ? (
              <ErrorState
                message={error}
                onRetry={refresh}
                style={styles.headerError}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : (
            <EmptyState message="No hay descargas. Añade contenido desde la biblioteca." />
          )
        }
        renderItem={({ item }) => {
          const isActive = activeIds.includes(item._id);
          const isPaused = pausedIds.includes(item._id);
          const showBar = isActive || isPaused || item.progressPct > 0;
          return (
            <View
              style={[styles.row, { backgroundColor: colors.backgroundElement }]}>
              <View style={styles.rowInfo}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {displayName(item.r2Key)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {statusLabel(item, isActive, isPaused)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Expira {new Date(item.expiresAt).toLocaleDateString()}
                </ThemedText>
                {showBar ? (
                  <ProgressBar progress={item.progressPct} active={isActive} />
                ) : null}
              </View>
              <View style={styles.rowActions}>
                {item.status === 'completed' ? (
                  <Pressable
                    onPress={() => play(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Reproducir ${displayName(item.r2Key)}`}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <Ionicons name="play" size={18} color={colors.text} />
                  </Pressable>
                ) : null}
                {item.status !== 'completed' ? (
                  <Pressable
                    onPress={() => {
                      void togglePause(item._id).catch(() => undefined);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isActive ? 'Pausar descarga' : 'Reanudar descarga'
                    }
                    style={({ pressed }) => pressed && styles.pressed}>
                    {isActive ? (
                      <Ionicons name="pause" size={18} color={colors.text} />
                    ) : (
                      <Ionicons name="play" size={18} color={colors.text} />
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => confirmRemove(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar descarga"
                  style={({ pressed }) => pressed && styles.pressed}>
                  <Ionicons name="close" size={18} color={colors.error} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  listEmpty: { justifyContent: 'flex-start' },
  header: { marginBottom: Spacing.two, gap: Spacing.one },
  headerError: { alignItems: 'flex-start', gap: Spacing.one, paddingVertical: 0 },
  row: {
    borderRadius: 12,
    padding: Spacing.threeAndHalf,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  rowInfo: { flex: 1, gap: Spacing.half },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  pressed: { opacity: 0.6 },
});
