import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useDownloadsStore } from '@/shared/services/download-manager';
import { api } from '@/shared/services/api';
import { useAuthStore } from '@/shared/store/auth';
import { useTheme } from '@/shared/hooks/use-theme';
import { getApiErrorMessage } from '@/shared/utils/api-error';

type Profile = { id: string; email: string };
type ScanStatus = { scanning: boolean; processed: number; total?: number; lastScanAt?: string };

const MAX_POLL = 120;

export function SettingsScreen() {
  const colors = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<{ processed: number; total?: number } | null>(null);
  const [purged, setPurged] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    api
      .get<Profile>('/users/me')
      .then(({ data }) => {
        setProfile(data);
        setProfileError(null);
      })
      .catch((e: unknown) => {
        setProfileError(getApiErrorMessage(e, 'No se pudo cargar el perfil'));
      });
  }, []);

  const sync = useCallback(async () => {
    setSyncState('scanning');
    setScanInfo(null);
    try {
      const startedAt = Date.now();
      await api.post('/library/scan', {});
      for (let i = 0; i < MAX_POLL; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const { data } = await api.get<ScanStatus>('/library/status');
        setScanInfo({ processed: data.processed, total: data.total });
        const last = data.lastScanAt ? Date.parse(data.lastScanAt) : 0;
        if (!data.scanning && last >= startedAt) {
          setSyncState('done');
          return;
        }
      }
      setSyncState('done');
    } catch (e) {
      setSyncState('error');
      setScanInfo(null);
      setSyncMessage(getApiErrorMessage(e, 'No se pudo sincronizar la biblioteca'));
    }
  }, []);

  const purge = useCallback(async () => {
    await useDownloadsStore.getState().purgeExpired();
    setPurged(true);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle">Ajustes</ThemedText>

        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <ThemedText type="smallBold">Perfil</ThemedText>
          {profile ? (
            <ThemedText type="small" themeColor="textSecondary">
              {profile.email}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor={profileError ? 'error' : 'textSecondary'}>
              {profileError ?? 'Cargando…'}
            </ThemedText>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <ThemedText type="smallBold">Biblioteca</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {syncState === 'scanning' && scanInfo
              ? `Escaneando… ${scanInfo.processed}${scanInfo.total ? ` / ${scanInfo.total}` : ''}`
              : syncState === 'done'
                ? 'Sincronización completada'
                : syncState === 'error'
                  ? (syncMessage ?? 'Error al sincronizar')
                  : 'Escanea R2 para indexar contenido nuevo'}
          </ThemedText>
          <Pressable
            onPress={() => void sync()}
            disabled={syncState === 'scanning'}
            style={[styles.button, { backgroundColor: colors.backgroundSelected }]}>
            {syncState === 'scanning' ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <ThemedText type="smallBold">Sincronizar ahora</ThemedText>
            )}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <ThemedText type="smallBold">Almacenamiento</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {purged
              ? 'Descargas expiradas purgadas'
              : 'Elimina descargas locales cuyo plazo de 7 días ha vencido'}
          </ThemedText>
          <Pressable
            onPress={() => void purge()}
            style={[styles.button, { backgroundColor: colors.backgroundSelected }]}>
            <ThemedText type="smallBold">Purgar expiradas</ThemedText>
          </Pressable>
        </View>

        <Pressable
          onPress={() => void logout()}
          style={[styles.button, styles.logout, { backgroundColor: colors.backgroundElement }]}>
          <ThemedText type="smallBold" themeColor="error">
            Cerrar sesión
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: { borderRadius: 12, padding: 16, gap: 10 },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logout: { alignItems: 'center', paddingVertical: 14 },
});
