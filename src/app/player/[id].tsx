import { useLocalSearchParams } from 'expo-router';

import { PlayerScreen } from '@/features/player/PlayerScreen';
import type { MediaItemType } from '@/shared/services/progressApi';

export default function PlayerRoute() {
  const { id, r2Key, subtitleKey, title, itemType, startAt } =
    useLocalSearchParams<{
      id: string;
      r2Key?: string;
      subtitleKey?: string;
      title?: string;
      itemType?: string;
      startAt?: string;
    }>();

  const resolvedType: MediaItemType | undefined =
    itemType === 'movie' ? 'movie' : itemType === 'episode' ? 'episode' : undefined;
  const position = startAt !== undefined ? Number(startAt) : undefined;

  return (
    <PlayerScreen
      id={id}
      r2Key={r2Key}
      subtitleKey={subtitleKey}
      title={title}
      itemType={resolvedType}
      startAt={position !== undefined && Number.isFinite(position) ? position : undefined}
    />
  );
}
