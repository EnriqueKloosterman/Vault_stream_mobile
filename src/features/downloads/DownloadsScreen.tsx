import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';

export function DownloadsScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle">Descargas</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          expo-file-system (DownloadTask: progreso, pausa/reanudación). Expiran a los 7 días
          (expiresAt) con purga pasiva — Fase 6.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
});
