import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';

type Props = { id: string };

export function PlayerScreen({ id }: Props) {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle">Reproduciendo</ThemedText>
        <ThemedText type="code">mediaId: {id}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          expo-video + presigned GET (TTL 600s) + progreso LWW. Subtítulos .srt: parseo JS con
          detección de charset y overlay sincronizado con currentTime — Fase 5/7.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  content: { padding: 16, gap: 8 },
});
