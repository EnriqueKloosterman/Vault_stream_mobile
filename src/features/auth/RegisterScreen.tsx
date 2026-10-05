import { Link } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { useForm } from 'react-hook-form';

import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useTheme } from '@/shared/hooks/use-theme';

type RegisterForm = { email: string; password: string; confirm: string };

export function RegisterScreen() {
  const colors = useTheme();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>();

  const onSubmit = (_data: RegisterForm) => {
    // TODO Fase 1: POST /auth/register via api -> useAuthStore.login(access_token)
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle">Registro</ThemedText>
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
          {...register('password', { required: 'Contraseña obligatoria', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
        />
        {errors.password && <ThemedText type="small">{errors.password.message}</ThemedText>}
        <TextInput
          style={[styles.input, inputStyle(colors)]}
          placeholder="Repetir contraseña"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          {...register('confirm', { required: 'Confirma la contraseña' })}
        />
        {errors.confirm && <ThemedText type="small">{errors.confirm.message}</ThemedText>}
        <ThemedText
          type="linkPrimary"
          onPress={handleSubmit(onSubmit)}
          suppressHighlighting>
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
