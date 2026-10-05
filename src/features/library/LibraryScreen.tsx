import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useTheme } from '@/shared/hooks/use-theme';

const PLACEHOLDER_ITEMS = [
  { id: 'sample-1', title: 'Película de ejemplo', kind: 'movie' },
  { id: 'sample-2', title: 'Serie de ejemplo', kind: 'series' },
];

export function LibraryScreen() {
  const colors = useTheme();

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={PLACEHOLDER_ITEMS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle">Biblioteca</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Índice desde R2 (carpetas primero, fallback por nombre) — Fase 7.
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { backgroundColor: colors.backgroundElement }]}
            onPress={() => undefined}>
            <ThemedText type="smallBold">{item.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.kind === 'movie' ? 'Película' : 'Serie'}
            </ThemedText>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12 },
  header: { marginBottom: 8, gap: 4 },
  row: { gap: 12 },
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    justifyContent: 'flex-end',
    gap: 4,
  },
});
