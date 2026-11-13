import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, Icon, Screen, ScreenHeader, TextField } from '@/components';
import { requestPasswordReset } from '@/features/auth/authService';
import { resetSentMessage } from '@/features/auth/errors';
import { forgotSchema, type ForgotValues } from '@/features/auth/schemas';
import { AuthScroll } from '@/features/auth/ui/AuthScroll';
import { FormError } from '@/features/auth/ui/FormError';
import { useAuthAction } from '@/features/auth/ui/useAuthAction';
import { useTheme } from '@/theme';

const RESEND_SECONDS = 30;

/** Forgot password (S06). Always shows the same neutral message, whether or not the email exists. */
export default function ForgotPassword() {
  const { spacing, colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const { busy, error, run, clearError } = useAuthAction<'send'>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const { control, handleSubmit, formState } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    mode: 'onChange',
    defaultValues: { email: params.email ?? '' },
  });

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = (email: string) =>
    void run('send', () => requestPasswordReset(email)).then((ok) => {
      if (ok) {
        setSentTo(email);
        setWait(RESEND_SECONDS);
      }
    });

  return (
    <Screen testID="screen-forgot-password">
      <ScreenHeader mode="nav" title="" onBack={() => router.back()} />
      <AuthScroll>
        {sentTo ? (
          <View style={{ gap: spacing.md }} testID="forgot-sent">
            <Icon name="mail" size={40} color={colors.primary} />
            <AppText variant="display" accessibilityRole="header">
              Check your email
            </AppText>
            <AppText variant="body" tone="ink2" testID="forgot-message">
              {resetSentMessage(sentTo)}
            </AppText>
            <FormError message={error?.message ?? null} />
            <Button
              label="Back to log in"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/log-in'))}
              testID="forgot-back"
            />
            <Button
              label={wait > 0 ? `Resend in ${wait}s` : 'Resend email'}
              variant="text"
              disabled={wait > 0}
              loading={busy === 'send'}
              onPress={() => send(sentTo)}
              testID="forgot-resend"
            />
          </View>
        ) : (
          <>
            <AppText
              variant="display"
              accessibilityRole="header"
              testID="screen-forgot-password-title"
            >
              Reset your password
            </AppText>
            <AppText
              variant="body"
              tone="ink2"
              style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}
            >
              Enter the email you signed up with and we&apos;ll send you a reset link.
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
                  autoComplete="email"
                  textContentType="emailAddress"
                  testID="forgot-email"
                />
              )}
            />
            <FormError message={error?.message ?? null} />
            <Button
              label="Send reset link"
              onPress={handleSubmit((v) => send(v.email.trim()))}
              disabled={!formState.isValid}
              loading={busy === 'send'}
              testID="forgot-submit"
            />
          </>
        )}
      </AuthScroll>
    </Screen>
  );
}
