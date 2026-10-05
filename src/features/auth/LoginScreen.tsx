import { Link } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { useForm } from 'react-hook-form';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useTheme } from '@/shared/hooks/use-theme';

type LoginForm = { email: string; password: string };

export function LoginScreen() {
  const colors = useTheme();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  const onSubmit = (_data: LoginForm) => {
    // TODO Fase 1: POST /auth/login via api -> useAuthStore.login(access_token)
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle">Iniciar sesión</ThemedText>
        <TextInput
          style={[styles.input, inputStyle(colors)]}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          {...register('email', { required: 'Email obligatorio' })}
        />
        {errors.email && <ThemedText type="small">{errors.email.message}</ThemedText>}
        <TextInput
          style={[styles.input, inputStyle(colors)]}
          placeholder="Contraseña"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          {...register('password', { required: 'Contraseña obligatoria' })}
        />
        {errors.password && <ThemedText type="small">{errors.password.message}</ThemedText>}
        <ThemedText
          type="linkPrimary"
          onPress={handleSubmit(onSubmit)}
          suppressHighlighting>
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
