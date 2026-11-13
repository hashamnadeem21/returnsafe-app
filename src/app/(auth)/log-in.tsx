import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, Screen, ScreenHeader, TextField } from '@/components';
import { logInWithEmail } from '@/features/auth/authService';
import { logInSchema, type LogInValues } from '@/features/auth/schemas';
import { AuthScroll } from '@/features/auth/ui/AuthScroll';
import { FormError } from '@/features/auth/ui/FormError';
import { useAuthAction } from '@/features/auth/ui/useAuthAction';
import { useTheme } from '@/theme';
import { autofill } from '@/lib/autofill';

/** Log in (S05). Wrong password and unknown email show the same message; the email is kept. */
export default function LogIn() {
  const { spacing } = useTheme();
  const { busy, error, run, clearError } = useAuthAction<'submit'>();
  const { control, handleSubmit, formState, getValues, resetField } = useForm<LogInValues>({
    resolver: zodResolver(logInSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (v: LogInValues) =>
    void run('submit', () => logInWithEmail(v.email.trim(), v.password)).then((ok) => {
      if (!ok) resetField('password');
    });

  return (
    <Screen testID="screen-log-in">
      <ScreenHeader mode="nav" title="" onBack={() => router.back()} />
      <AuthScroll>
        <AppText variant="display" accessibilityRole="header" testID="screen-log-in-title">
          Welcome back
        </AppText>
        <AppText
          variant="body"
          tone="ink2"
          style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}
        >
          Log in to see your receipts.
        </AppText>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              label="Email"
              value={field.value}
              onChangeText={(t) => {
                field.onChange(t);
                if (error) clearError();
              }}
              onBlur={field.onBlur}
              error={fieldState.isTouched ? fieldState.error?.message : undefined}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              {...autofill('username')}
              testID="login-email"
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              label="Password"
              secure
              value={field.value}
              onChangeText={(t) => {
                field.onChange(t);
                if (error) clearError();
              }}
              onBlur={field.onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              {...autofill('current-password')}
              testID="login-password"
            />
          )}
        />
        <View style={{ alignItems: 'flex-end', marginTop: -spacing.xs, marginBottom: spacing.sm }}>
          <Button
            label="Forgot password?"
            variant="text"
            style={{ alignSelf: 'auto' }}
            onPress={() =>
              router.push({
                pathname: '/forgot-password',
                params: { email: getValues('email').trim() },
              })
            }
            testID="login-forgot"
          />
        </View>
        <FormError message={error?.message ?? null} />
        <Button
          label="Log in"
          onPress={handleSubmit(onSubmit)}
          disabled={!formState.isValid}
          loading={busy === 'submit'}
          testID="login-submit"
        />
        <View style={[styles.footer, { marginTop: spacing.lg }]}>
          <AppText variant="body" tone="ink2">
            New here?
          </AppText>
          <Button
            label="Create account"
            variant="text"
            style={{ alignSelf: 'auto' }}
            onPress={() => router.replace('/sign-up')}
            testID="login-to-signup"
          />
        </View>
      </AuthScroll>
    </Screen>
  );
}

const styles = {
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
} as const;
