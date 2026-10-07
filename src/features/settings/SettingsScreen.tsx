import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { ErrorState } from '@/shared/components/state-views';
import { MaxContentWidth, Spacing } from '@/shared/constants/theme';
import { useDownloadsStore } from '@/shared/services/download-manager';
import { api } from '@/shared/services/api';
import { deleteAccountRequest } from '@/shared/services/authApi';
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
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  const loadProfile = useCallback(() => {
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

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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
    const purgedCount = await useDownloadsStore.getState().purgeExpired();
    setPurgeMessage(
      purgedCount > 0
        ? 'Descargas expiradas purgadas'
        : 'No había descargas expiradas',
    );
  }, []);

  const confirmLogout = useCallback(() => {
    Alert.alert(
      'Cerrar sesión',
      'Se cerrará la sesión en este dispositivo. Podrás volver a iniciarla cuando quieras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => {
            setLoggingOut(true);
            void logout().finally(() => setLoggingOut(false));
          },
        },
      ],
    );
  }, [logout]);

  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(
      'Eliminar cuenta',
      'Se eliminarán definitivamente tu cuenta, tu biblioteca y tu progreso. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar cuenta',
          style: 'destructive',
          onPress: () => {
            setDeletingAccount(true);
            deleteAccountRequest()
              .then(() => logout())
              .catch((e: unknown) => {
                setDeletingAccount(false);
                Alert.alert(
                  'Error',
                  getApiErrorMessage(e, 'No se pudo eliminar la cuenta'),
                );
              });
          },
        },
      ],
    );
  }, [logout]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <ThemedText type="smallBold">Perfil</ThemedText>
          {profile ? (
            <ThemedText type="small" themeColor="textSecondary">
              {profile.email}
            </ThemedText>
          ) : profileError ? (
            <ErrorState
              message={profileError}
              onRetry={loadProfile}
              style={styles.profileError}
            />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Cargando…
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
            accessibilityRole="button"
            accessibilityLabel="Sincronizar biblioteca"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.backgroundSelected },
              pressed && styles.pressed,
            ]}>
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
            {purgeMessage ??
              'Elimina descargas locales cuyo plazo de 7 días ha vencido'}
          </ThemedText>
          <Pressable
            onPress={() => void purge()}
            accessibilityRole="button"
            accessibilityLabel="Purgar descargas expiradas"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">Purgar expiradas</ThemedText>
          </Pressable>
        </View>

        <Pressable
          onPress={confirmLogout}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          style={({ pressed }) => [
            styles.button,
            styles.logout,
            { backgroundColor: colors.backgroundElement },
            pressed && styles.pressed,
          ]}>
          {loggingOut ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <ThemedText type="smallBold" themeColor="error">
              Cerrar sesión
            </ThemedText>
          )}
        </Pressable>

        <Pressable
          onPress={confirmDeleteAccount}
          disabled={deletingAccount}
          accessibilityRole="button"
          accessibilityLabel="Eliminar cuenta"
          style={({ pressed }) => [
            styles.button,
            styles.logout,
            styles.deleteAccount,
            pressed && styles.pressed,
          ]}>
          {deletingAccount ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <ThemedText type="smallBold" themeColor="error">
              Eliminar cuenta
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: 12, padding: Spacing.four, gap: Spacing.twoAndHalf },
  button: {
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logout: { alignItems: 'center', paddingVertical: Spacing.threeAndHalf },
  deleteAccount: { borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)' },
  profileError: { paddingVertical: 0, alignItems: 'flex-start' },
  pressed: { opacity: 0.6 },
});
