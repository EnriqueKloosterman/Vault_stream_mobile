import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/shared/components/icon-button';
import { Spacing } from '@/shared/constants/theme';
import { findLocalPlaybackFile } from '@/shared/services/download-manager';
import {
  fetchLibraryItem,
  presignSubtitle,
  presignVideo,
} from '@/shared/services/libraryApi';
import type { MediaItemType } from '@/shared/services/progressApi';
import { useProgressQueueStore } from '@/shared/store/progress-queue';
import { getApiErrorMessage } from '@/shared/utils/api-error';
import { decodeSubtitleBytes, findCueAt, parseSrt, type SrtCue } from '@/shared/utils/srt';

type Props = {
  id: string;
  r2Key?: string;
  subtitleKey?: string;
  title?: string;
  itemType?: MediaItemType;
  startAt?: number;
};

const REPORT_INTERVAL_MS = 10_000;
const CHROME_TIMEOUT_MS = 4_000;
const PLAYBACK_ERROR = 'No se pudo reproducir el vídeo';

export function PlayerScreen({ id, r2Key, subtitleKey, title, itemType, startAt }: Props) {
  const player = useVideoPlayer(null, (instance) => {
    instance.timeUpdateEventInterval = 0.5;
  });
  const { status, error: playerError } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [cues, setCues] = useState<SrtCue[]>([]);
  const [resolvedSource, setResolvedSource] = useState<string | null>(r2Key ?? null);
  const [resolvedSubtitle, setResolvedSubtitle] = useState<string | null>(
    subtitleKey || null,
  );
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [subtitlesOn, setSubtitlesOn] = useState(true);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const lastReportRef = useRef(0);
  const insets = useSafeAreaInsets();

  const report = useCallback(
    (positionSec: number, overridePct?: number) => {
      if (!itemType) {
        return;
      }
      const duration = Math.floor(durationRef.current);
      const position = Math.max(0, Math.floor(positionSec));
      const completedPct =
        overridePct !== undefined
          ? overridePct
          : duration > 0
            ? Math.min(100, Math.round((position / duration) * 100))
            : 0;
      useProgressQueueStore.getState().enqueue({
        itemType,
        refId: id,
        currentTimeSec: position,
        durationSec: duration,
        completedPct,
        lastUpdated: Date.now(),
      });
    },
    [itemType, id],
  );

  useEventListener(player, 'timeUpdate', (event) => {
    currentTimeRef.current = event.currentTime;
    if (!durationRef.current) {
      durationRef.current = player.duration || 0;
    }
    setCurrentTime(event.currentTime);
    const now = Date.now();
    if (now - lastReportRef.current >= REPORT_INTERVAL_MS) {
      lastReportRef.current = now;
      report(event.currentTime);
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    durationRef.current = player.duration || durationRef.current;
    if (!isPlaying) {
      report(currentTimeRef.current);
    }
  });

  useEventListener(player, 'playToEnd', () => {
    report(currentTimeRef.current, 100);
  });

  useEffect(() => {
    return () => {
      if (currentTimeRef.current > 0) {
        report(currentTimeRef.current);
      }
    };
  }, [report]);

  useEffect(() => {
    if (!chromeVisible || fullscreen) {
      return;
    }
    const timer = setTimeout(() => setChromeVisible(false), CHROME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [chromeVisible, fullscreen]);

  useEffect(() => {
    if (r2Key) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const item = await fetchLibraryItem(id);
        if (cancelled) {
          return;
        }
        if (!item.r2Key) {
          setPrepareError('Este contenido no tiene vídeo disponible');
          return;
        }
        setResolvedSource(item.r2Key);
        if (!subtitleKey && item.subtitleKey) {
          setResolvedSubtitle(item.subtitleKey);
        }
      } catch (e) {
        if (!cancelled) {
          setPrepareError(getApiErrorMessage(e, 'No se pudo obtener el vídeo'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, r2Key, subtitleKey, attempt]);

  useEffect(() => {
    if (!resolvedSource) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const localUri = itemType ? await findLocalPlaybackFile(itemType, id) : null;
        if (cancelled) {
          return;
        }
        if (localUri) {
          await player.replaceAsync(localUri);
        } else {
          const { url } = await presignVideo(resolvedSource);
          if (cancelled) {
            return;
          }
          await player.replaceAsync(url);
        }
        if (cancelled) {
          return;
        }
        if (startAt && startAt > 0) {
          player.seekBy(startAt);
        }
        player.play();
      } catch (e) {
        if (!cancelled) {
          setPrepareError(
            getApiErrorMessage(e, 'No se pudo iniciar la reproducción'),
          );
        }
      } finally {
        if (!cancelled) {
          setPreparing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, resolvedSource, startAt, itemType, id, attempt]);

  useEffect(() => {
    if (!resolvedSubtitle) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { url } = await presignSubtitle(resolvedSubtitle);
        const response = await fetch(url);
        if (!response.ok) {
          return;
        }
        const buffer = await response.arrayBuffer();
        if (cancelled) {
          return;
        }
        const text = decodeSubtitleBytes(new Uint8Array(buffer));
        const parsed = parseSrt(text);
        if (!cancelled) {
          setCues(parsed);
        }
      } catch {
        // Los subtítulos son opcionales: se omite el overlay si fallan.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedSubtitle]);

  const cue = useMemo(() => findCueAt(cues, currentTime), [cues, currentTime]);
  const failed =
    prepareError !== null || (status === 'error' && !resolvedSource);
  const failedPlayer = status === 'error' && prepareError === null;
  const busy =
    !failed &&
    !failedPlayer &&
    (preparing || status === 'loading' || status === 'idle');
  const errorMessage =
    prepareError ??
    (playerError ? getApiErrorMessage(playerError, PLAYBACK_ERROR) : PLAYBACK_ERROR);

  const close = useCallback(() => {
    router.back();
  }, []);

  const retry = useCallback(() => {
    setPrepareError(null);
    setPreparing(true);
    setChromeVisible(true);
    setAttempt((value) => value + 1);
  }, []);

  const toggleSubtitles = useCallback(() => {
    setSubtitlesOn((value) => !value);
  }, []);

  if (failed || failedPlayer) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            onPress={retry}
            style={({ pressed }) => [styles.errorButton, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
          >
            <Text style={styles.errorButtonLabel}>Reintentar</Text>
          </Pressable>
          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.errorLink, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Text style={styles.errorLinkLabel}>Volver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        onFullscreenEnter={() => setFullscreen(true)}
        onFullscreenExit={() => {
          setFullscreen(false);
          setChromeVisible(true);
        }}
      />
      {busy ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : null}
      {!fullscreen && chromeVisible ? (
        <View
          style={[styles.topBar, { paddingTop: insets.top + Spacing.four }]}
          pointerEvents="box-none"
        >
          <IconButton onPress={close} accessibilityLabel="Cerrar reproductor">
            <Ionicons name="close" size={22} color="#ffffff" />
          </IconButton>
          <Text style={styles.topTitle} numberOfLines={1}>
            {title ?? ''}
          </Text>
          <IconButton
            onPress={toggleSubtitles}
            accessibilityLabel="Subtítulos"
            accessibilityState={{ selected: subtitlesOn }}
          >
            <Text style={[styles.cc, subtitlesOn ? null : styles.ccOff]}>CC</Text>
          </IconButton>
        </View>
      ) : null}
      {!fullscreen && !chromeVisible ? (
        <Pressable
          onPress={() => setChromeVisible(true)}
          style={[styles.topZone, { height: insets.top + 96 }]}
          accessibilityRole="button"
          accessibilityLabel="Mostrar controles del reproductor"
        />
      ) : null}
      {subtitlesOn && cue ? (
        <View style={styles.subtitleWrap} pointerEvents="none">
          <Text style={styles.subtitleText}>{cue.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.eight,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  topZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cc: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: Spacing.oneAndHalf,
    paddingVertical: Spacing.half,
    borderWidth: 1,
    borderColor: '#ffffff',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ccOff: { opacity: 0.4 },
  subtitleWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 96,
    alignItems: 'center',
  },
  subtitleText: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  errorText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  errorButton: {
    borderRadius: 10,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    backgroundColor: '#2E3135',
  },
  errorButtonLabel: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  errorLink: { paddingHorizontal: Spacing.five, paddingVertical: Spacing.three },
  errorLinkLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.8,
  },
  pressed: { opacity: 0.6 },
});
