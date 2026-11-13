import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { AppText, Banner, Button, Card, Screen, ScreenHeader } from '@/components';
import {
  signInToExistingAndMerge,
  signInWithApple,
  signInWithGoogle,
  signOut,
} from '@/features/auth/authService';
import { CredentialInUseSheet } from '@/features/auth/ui/CredentialInUseSheet';
import { FormError } from '@/features/auth/ui/FormError';
import { SocialButtons } from '@/features/auth/ui/SocialButtons';
import { useAuthAction } from '@/features/auth/ui/useAuthAction';
import { USE_EMULATORS } from '@/lib/firebase';
import { useSession } from '@/stores/session';
import { useTheme } from '@/theme';

/** Account (S18): guest "save your account" options, Sign out, Delete account. */
export default function Account() {
  const { spacing } = useTheme();
  const user = useSession((s) => s.user);
  const guest = user?.isAnonymous ?? false;
  const { busy, error, credentialInUse, run, dismissCredentialInUse } = useAuthAction<
    'apple' | 'google' | 'merge' | 'signout'
  >();
  const [verifyNote] = useState(() => user?.email && !user.emailVerified && !guest);

  const doSignOut = () => void run('signout', signOut);
  const confirmSignOut = () => {
    if (!guest) return doSignOut();
    Alert.alert(
      'Sign out of the guest account?',
      'Guest receipts are only kept on this account. Save your account first if you want to keep them.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out anyway', style: 'destructive', onPress: doSignOut },
      ],
    );
  };

  return (
    <Screen testID="screen-settings-account">
      <ScreenHeader
        mode="nav"
        title="Account"
        onBack={() => router.back()}
        testID="screen-settings-account-title"
      />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg }}>
        {guest ? (
          <View style={{ gap: spacing.md }} testID="account-guest">
            <Banner
              kind="warn"
              message="You're using a guest account. Save it so you don't lose your receipts if you change phones."
            />
            <SocialButtons
              verb="save"
              busy={busy === 'apple' || busy === 'google' ? busy : null}
              disabled={busy !== null}
              onApple={() => void run('apple', signInWithApple)}
              onGoogle={() => void run('google', signInWithGoogle)}
            />
            <Button
              label="Save with email"
              variant="secondary"
              icon="mail"
              disabled={busy !== null}
              onPress={() => router.push('/settings/save-account')}
              testID="account-save-email"
            />
          </View>
        ) : (
          <Card style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText variant="caption">Signed in as</AppText>
            <AppText variant="headline" testID="account-email">
              {user?.email ?? user?.displayName ?? 'Your account'}
            </AppText>
          </Card>
        )}
        {verifyNote ? (
          <Banner
            kind="info"
            message={`Verify your email: we sent a link to ${user?.email}.`}
            testID="account-verify-banner"
          />
        ) : null}
        <FormError message={error?.message ?? null} />
        <Button
          label="Sign out"
          variant="secondary"
          loading={busy === 'signout'}
          disabled={busy !== null && busy !== 'signout'}
          onPress={confirmSignOut}
          testID="account-sign-out"
        />
        <Button
          label="Delete account"
          variant="text"
          disabled={busy !== null}
          onPress={() => router.push('/settings/delete-account')}
          testID="account-delete"
        />
        {USE_EMULATORS && user ? (
          <AppText variant="caption" align="center" selectable testID="account-uid">
            {`uid:${user.uid}`}
          </AppText>
        ) : null}
      </ScrollView>
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
