import { Link, Redirect } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { useForm } from 'react-hook-form';

import { PasswordInput } from '@/shared/components/password-input';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useTheme } from '@/shared/hooks/use-theme';
import { loginRequest } from '@/shared/services/authApi';
import { useAuthStore } from '@/shared/store/auth';
import { getApiErrorMessage } from '@/shared/utils/api-error';
import { toTextInputProps } from '@/shared/utils/rn-form';

type LoginForm = { email: string; password: string };

export function LoginScreen() {
  const colors = useTheme();
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  const onSubmit = handleSubmit(async (data) => {
    try {
      const accessToken = await loginRequest(data.email.trim(), data.password);
      await login(accessToken);
    } catch (error) {
      setError('root', {
        message: getApiErrorMessage(error, 'No se pudo iniciar sesión'),
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
  });

  if (token) {
    return <Redirect href="/" />;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle">Iniciar sesión</ThemedText>
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
        <ThemedText type="linkPrimary" onPress={onSubmit} suppressHighlighting>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </ThemedText>
        <Link href="/auth/register" asChild>
          <ThemedText type="small" themeColor="textSecondary">
            ¿No tienes cuenta? Regístrate
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
