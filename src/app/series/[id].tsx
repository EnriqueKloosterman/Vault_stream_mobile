import { useLocalSearchParams } from 'expo-router';

import { SeriesDetailScreen } from '@/features/series/SeriesDetailScreen';

export default function SeriesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SeriesDetailScreen id={id} />;
}
