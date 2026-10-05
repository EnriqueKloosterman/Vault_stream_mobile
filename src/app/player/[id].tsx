import { useLocalSearchParams } from 'expo-router';

import { PlayerScreen } from '@/features/player/PlayerScreen';

export default function PlayerRoute() {
  const { id, r2Key, subtitleKey, title } = useLocalSearchParams<{
    id: string;
    r2Key?: string;
    subtitleKey?: string;
    title?: string;
  }>();
  return (
    <PlayerScreen id={id} r2Key={r2Key} subtitleKey={subtitleKey} title={title} />
  );
}
