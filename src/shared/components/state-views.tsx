import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/shared/constants/theme';
import { ThemedText } from '@/shared/components/themed-text';
import { useTheme } from '@/shared/hooks/use-theme';

type Variant = 'inline' | 'fill';

type Props = {
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

function containerStyle(variant: Variant): StyleProp<ViewStyle> {
  return variant === 'fill' ? styles.fill : styles.inline;
}

export function LoadingState({ variant = 'inline', style }: Props) {
  const colors = useTheme();
  return (
    <ActivityIndicator
      color={colors.textSecondary}
      style={[containerStyle(variant), style]}
    />
  );
}

export function ErrorState({
  message,
  onRetry,
  variant = 'inline',
  style,
}: Props & { message: string; onRetry: () => void }) {
  return (
    <View style={[containerStyle(variant), style]}>
      <ThemedText type="small" themeColor="error">
        {message}
      </ThemedText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Reintentar"
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
        <ThemedText type="link" themeColor="link">Reintentar</ThemedText>
      </Pressable>
    </View>
  );
}

export function EmptyState({
  message,
  variant = 'inline',
  style,
}: Props & { message: string }) {
  return (
    <View style={[containerStyle(variant), style]}>
      <ThemedText type="small" themeColor="textSecondary">
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.eight,
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  retry: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.6 },
});
