import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';

type Props = { id: string };

export function SeriesDetailScreen({ id }: Props) {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle">Serie</ThemedText>
        <ThemedText type="code">seriesId: {id}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Temporadas y episodios (GET /series/:id) — Fase 7.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
});
