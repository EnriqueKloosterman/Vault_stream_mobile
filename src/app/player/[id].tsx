import { useLocalSearchParams } from 'expo-router';

import { PlayerScreen } from '@/features/player/PlayerScreen';

export default function PlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlayerScreen id={id} />;
}
