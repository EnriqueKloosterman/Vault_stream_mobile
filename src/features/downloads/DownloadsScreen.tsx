import { router } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
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
  const togglePause = useDownloadsStore((s) => s.togglePause);
  const remove = useDownloadsStore((s) => s.remove);

  useEffect(() => {
    void init();
  }, [init]);

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
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle">Descargas</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Disponibles sin conexión durante 7 días.
            </ThemedText>
            {error ? (
              <ThemedText type="small" themeColor="error">
                {error}
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.centered} color={colors.textSecondary} />
          ) : (
            <View style={styles.centered}>
              <ThemedText type="small" themeColor="textSecondary">
                No hay descargas. Añade contenido desde la biblioteca.
              </ThemedText>
            </View>
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
                <ThemedText type="code" themeColor="textSecondary">
                  Expira {new Date(item.expiresAt).toLocaleDateString()}
                </ThemedText>
                {showBar ? (
                  <View style={[styles.track, { backgroundColor: colors.backgroundSelected }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${Math.min(100, item.progressPct)}%`,
                          backgroundColor: isActive ? '#3c87f7' : colors.textSecondary,
                        },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
              <View style={styles.rowActions}>
                {item.status === 'completed' ? (
                  <Pressable onPress={() => play(item)} hitSlop={8}>
                    <ThemedText type="smallBold">▶</ThemedText>
                  </Pressable>
                ) : null}
                {item.status !== 'completed' ? (
                  <Pressable onPress={() => void togglePause(item._id)} hitSlop={8}>
                    <ThemedText type="smallBold">{isActive ? '⏸' : '▶'}</ThemedText>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => void remove(item._id)} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="error">
                    ✕
                  </ThemedText>
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
  list: { padding: 16, gap: 12, flexGrow: 1 },
  listEmpty: { justifyContent: 'flex-start' },
  header: { marginBottom: 8, gap: 4 },
  row: { borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12 },
  rowInfo: { flex: 1, gap: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: 6, borderRadius: 3 },
  centered: { paddingVertical: 32, alignItems: 'center', gap: 8 },
});
