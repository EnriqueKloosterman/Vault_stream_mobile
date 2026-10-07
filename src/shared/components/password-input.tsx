import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/use-theme';

export type PasswordInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
};

export function PasswordInput({
  containerStyle,
  style,
  ...rest
}: PasswordInputProps) {
  const colors = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: colors.backgroundSelected,
          backgroundColor: colors.backgroundElement,
        },
        containerStyle,
      ]}
    >
      <TextInput
        {...rest}
        style={[styles.input, { color: colors.text }, style]}
        secureTextEntry={!visible}
      />
      <Pressable
        onPress={() => setVisible((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={
          visible ? 'Ocultar contraseña' : 'Mostrar contraseña'
        }
        hitSlop={10}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Ionicons
          name={visible ? 'eye-off' : 'eye'}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoAndHalf,
    fontSize: 16,
  },
  toggle: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoAndHalf,
  },
  pressed: { opacity: 0.6 },
});
