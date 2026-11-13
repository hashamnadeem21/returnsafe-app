import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, Screen, ScreenHeader } from '@/components';
import { signUpWithEmail } from '@/features/auth/authService';
import { AuthScroll } from '@/features/auth/ui/AuthScroll';
import { SignUpForm } from '@/features/auth/ui/SignUpForm';
import { useAuthAction } from '@/features/auth/ui/useAuthAction';
import { useSession } from '@/stores/session';
import { useTheme } from '@/theme';

/** Sign up (S04). New accounts see the notification primer before Home. */
export default function SignUp() {
  const { spacing } = useTheme();
  const setShowPrimer = useSession((s) => s.setShowPrimer);
  const { busy, error, run, clearError } = useAuthAction<'submit'>();

  return (
    <Screen testID="screen-sign-up">
      <ScreenHeader mode="nav" title="" onBack={() => router.back()} />
      <AuthScroll>
        <AppText variant="display" accessibilityRole="header" testID="screen-sign-up-title">
          Create your account
        </AppText>
        <AppText
          variant="body"
          tone="ink2"
          style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}
        >
          Keep your receipts safe and synced.
        </AppText>
        <SignUpForm
          submitLabel="Create account"
          busy={busy === 'submit'}
          error={error?.message ?? null}
          onChange={error ? clearError : undefined}
          errorAction={
            error?.kind === 'email-in-use' || error?.kind === 'other-provider' ? (
              <View style={{ marginBottom: spacing.sm }}>
                <Button
                  label={
                    error.kind === 'email-in-use' ? 'Log in instead' : 'Back to sign-in options'
                  }
                  variant="soft"
                  onPress={() =>
                    error.kind === 'email-in-use' ? router.replace('/log-in') : router.back()
                  }
                  testID="signup-error-action"
                />
              </View>
            ) : null
          }
          onSubmit={(v) =>
            void run('submit', async () => {
              // Set before sign-up: the auth gate redirects as soon as Firebase reports the user.
              setShowPrimer(true);
              try {
                await signUpWithEmail(v.email.trim(), v.password, v.name?.trim() || undefined);
              } catch (e) {
                setShowPrimer(false);
                throw e;
              }
            })
          }
        />
        <View style={[styles.footer, { marginTop: spacing.lg }]}>
          <AppText variant="body" tone="ink2">
            Already have an account?
          </AppText>
          <Button
            label="Log in"
            variant="text"
            onPress={() => router.replace('/log-in')}
            testID="signup-to-login"
            style={{ alignSelf: 'auto' }}
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
