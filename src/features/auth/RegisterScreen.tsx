import { Link, Redirect } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { useForm } from 'react-hook-form';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useTheme } from '@/shared/hooks/use-theme';
import { registerRequest } from '@/shared/services/authApi';
import { useAuthStore } from '@/shared/store/auth';
import { getApiErrorMessage } from '@/shared/utils/api-error';

type RegisterForm = { email: string; password: string; confirm: string };

export function RegisterScreen() {
  const colors = useTheme();
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const {
    register,
    handleSubmit,
    getValues,
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

  if (token) {
    return <Redirect href="/" />;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle">Registro</ThemedText>
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
          {...register('email', {
            required: 'Email obligatorio',
            pattern: {
              value: /^\S+@\S+\.\S+$/,
              message: 'Email no válido',
            },
          })}
        />
        {errors.email && (
          <ThemedText type="small" themeColor="error">
            {errors.email.message}
          </ThemedText>
        )}
        <TextInput
          style={[styles.input, inputStyle(colors)]}
          placeholder="Contraseña"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          {...register('password', {
            required: 'Contraseña obligatoria',
            minLength: {
              value: 8,
              message: 'Mínimo 8 caracteres',
            },
            maxLength: {
              value: 72,
              message: 'Máximo 72 caracteres',
            },
          })}
        />
        {errors.password && (
          <ThemedText type="small" themeColor="error">
            {errors.password.message}
          </ThemedText>
        )}
        <TextInput
          style={[styles.input, inputStyle(colors)]}
          placeholder="Repetir contraseña"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          {...register('confirm', {
            required: 'Confirma la contraseña',
            validate: (value) =>
              value === getValues('password') ||
              'Las contraseñas no coinciden',
          })}
        />
        {errors.confirm && (
          <ThemedText type="small" themeColor="error">
            {errors.confirm.message}
          </ThemedText>
        )}
        <ThemedText type="linkPrimary" onPress={onSubmit} suppressHighlighting>
          {isSubmitting ? 'Creando…' : 'Crear cuenta'}
        </ThemedText>
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
  content: { padding: 16, gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
