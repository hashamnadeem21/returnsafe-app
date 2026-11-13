import { router } from 'expo-router';

import { AppText, Screen, ScreenHeader } from '@/components';
import { signInToExistingAndMerge, signUpWithEmail } from '@/features/auth/authService';
import { AuthScroll } from '@/features/auth/ui/AuthScroll';
import { CredentialInUseSheet } from '@/features/auth/ui/CredentialInUseSheet';
import { SignUpForm } from '@/features/auth/ui/SignUpForm';
import { useAuthAction } from '@/features/auth/ui/useAuthAction';
import { useTheme } from '@/theme';

/** Guest → email account. Links the credential to the guest, so the uid and the guest's data stay. */
export default function SaveAccount() {
  const { spacing } = useTheme();
  const { busy, error, credentialInUse, run, clearError, dismissCredentialInUse } = useAuthAction<
    'submit' | 'merge'
  >();

  return (
    <Screen testID="screen-save-account">
      <ScreenHeader mode="nav" title="" onBack={() => router.back()} />
      <AuthScroll>
        <AppText variant="display" accessibilityRole="header" testID="screen-save-account-title">
          Save your account
        </AppText>
        <AppText
          variant="body"
          tone="ink2"
          style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}
        >
          Your receipts stay right where they are.
        </AppText>
        <SignUpForm
          submitLabel="Save account"
          busy={busy === 'submit'}
          error={error?.message ?? null}
          onChange={error ? clearError : undefined}
          onSubmit={(v) =>
            void run('submit', () =>
              signUpWithEmail(v.email.trim(), v.password, v.name?.trim() || undefined),
            ).then((ok) => {
              if (ok) router.back();
            })
          }
        />
      </AuthScroll>
      <CredentialInUseSheet
        visible={credentialInUse !== null}
        canSignIn={credentialInUse?.credential != null}
        busy={busy === 'merge'}
        onClose={dismissCredentialInUse}
        onSignIn={() => {
          const cred = credentialInUse?.credential;
          if (cred) void run('merge', () => signInToExistingAndMerge(cred));
        }}
      />
    </Screen>
  );
}
