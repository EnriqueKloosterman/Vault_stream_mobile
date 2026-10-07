import { Link, Redirect } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useForm } from 'react-hook-form';

import { PasswordInput } from '@/shared/components/password-input';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/use-theme';
import { registerRequest } from '@/shared/services/authApi';
import { useAuthStore } from '@/shared/store/auth';
import { getApiErrorMessage } from '@/shared/utils/api-error';
import { toTextInputProps } from '@/shared/utils/rn-form';

type RegisterForm = { email: string; password: string; confirm: string };

export function RegisterScreen() {
  const colors = useTheme();
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>();

  const onSubmit = handleSubmit(async (data) => {
    try {
      const accessToken = await registerRequest(
        data.email.trim(),
        data.password,
      );
      await login(accessToken);
    } catch (error) {
      setError('root', {
        message: getApiErrorMessage(error, 'No se pudo crear la cuenta'),
      });
    }
  });

  const emailField = register('email', {
    required: 'Email obligatorio',
    pattern: {
      value: /^\S+@\S+\.\S+$/,
      message: 'Email no válido',
    },
  });
  const passwordField = register('password', {
    required: 'Contraseña obligatoria',
    minLength: {
      value: 8,
      message: 'Mínimo 8 caracteres',
    },
    maxLength: {
      value: 72,
      message: 'Máximo 72 caracteres',
    },
  });
  const confirmField = register('confirm', {
    required: 'Confirma la contraseña',
    validate: (value, formValues) =>
      value === formValues.password || 'Las contraseñas no coinciden',
  });

  if (token) {
    return <Redirect href="/" />;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        {errors.root?.message && (
          <ThemedText type="small" themeColor="error">
            {errors.root.message}
          </ThemedText>
        )}
        <TextInput
          style={[styles.input, inputStyle(colors)]}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          {...toTextInputProps(emailField)}
        />
        {errors.email && (
          <ThemedText type="small" themeColor="error">
            {errors.email.message}
          </ThemedText>
        )}
        <PasswordInput
          placeholder="Contraseña"
          placeholderTextColor={colors.textSecondary}
          {...toTextInputProps(passwordField)}
        />
        {errors.password && (
          <ThemedText type="small" themeColor="error">
            {errors.password.message}
          </ThemedText>
        )}
        <PasswordInput
          placeholder="Repetir contraseña"
          placeholderTextColor={colors.textSecondary}
          {...toTextInputProps(confirmField)}
        />
        {errors.confirm && (
          <ThemedText type="small" themeColor="error">
            {errors.confirm.message}
          </ThemedText>
        )}
        <Pressable
          onPress={onSubmit}
          accessibilityRole="button"
          accessibilityLabel={isSubmitting ? 'Creando cuenta' : 'Crear cuenta'}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="link" themeColor="link">
            {isSubmitting ? 'Creando…' : 'Crear cuenta'}
          </ThemedText>
        </Pressable>
        <Link href="/auth/login" asChild>
          <ThemedText type="small" themeColor="textSecondary">
            ¿Ya tienes cuenta? Inicia sesión
          </ThemedText>
        </Link>
      </View>
    </ThemedView>
  );
}

const inputStyle = (colors: ReturnType<typeof useTheme>) => ({
  color: colors.text,
  borderColor: colors.backgroundSelected,
  backgroundColor: colors.backgroundElement,
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoAndHalf,
    fontSize: 16,
  },
  pressed: { opacity: 0.6 },
});
