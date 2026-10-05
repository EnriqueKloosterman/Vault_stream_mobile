import { useLocalSearchParams } from 'expo-router';

import { ItemDetailScreen } from '@/features/library/ItemDetailScreen';

export default function ItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemDetailScreen id={id} />;
}
