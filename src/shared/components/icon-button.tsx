import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  children: ReactNode;
};

export function IconButton({
  onPress,
  accessibilityLabel,
  accessibilityState,
  style,
  hitSlop = 8,
  children,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [styles.target, style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
