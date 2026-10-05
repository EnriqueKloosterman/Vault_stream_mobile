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
  const currentTimeRef = useRef(0);
  const lastReportRef = useRef(0);

  const report = useCallback(
    (positionSec: number, overridePct?: number) => {
      if (!itemType) {
        return;
      }
      const duration = Math.floor(player.duration || 0);
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
    [itemType, id, player],
  );

  useEventListener(player, 'timeUpdate', (event) => {
    currentTimeRef.current = event.currentTime;
    setCurrentTime(event.currentTime);
    const now = Date.now();
    if (now - lastReportRef.current >= REPORT_INTERVAL_MS) {
      lastReportRef.current = now;
      report(event.currentTime);
    }
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (!isPlaying) {
      report(currentTimeRef.current);
    }
  });

  useEventListener(player, 'playToEnd', () => {
    report(currentTimeRef.current, 100);
  });

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
        setResolvedSource(item.r2Key);
        if (!subtitleKey && item.subtitleKey) {
          setResolvedSubtitle(item.subtitleKey);
        }
      } catch (e) {
        if (!cancelled) {
          setPrepareError(getApiErrorMessage(e, 'No se pudo obtener el vídeo'));
          setPreparing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, r2Key, subtitleKey]);

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
  }, [player, resolvedSource, startAt, itemType, id]);

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

  const close = useCallback(() => {
    router.back();
  }, []);

  if (failed || failedPlayer) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {prepareError ??
              playerError?.message ??
              'No se pudo reproducir el vídeo'}
          </Text>
          <Pressable onPress={close} style={styles.errorButton} hitSlop={8}>
            <Text style={styles.errorButtonLabel}>Volver</Text>
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
      />
      {busy ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : null}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={close} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {title ?? ''}
        </Text>
      </View>
      {cue ? (
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
    gap: 16,
    paddingHorizontal: 32,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  close: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  topTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2E3135',
  },
  errorButtonLabel: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
