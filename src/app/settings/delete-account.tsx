import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { AppText, Banner, Button, Screen, ScreenHeader, Sheet, TextField } from '@/components';
import { deleteAccount, reauthenticate, reauthMethod } from '@/features/auth/authService';
import { AuthScroll } from '@/features/auth/ui/AuthScroll';
import { FormError } from '@/features/auth/ui/FormError';
import { useAuthAction } from '@/features/auth/ui/useAuthAction';
import { auth } from '@/lib/firebase';
import { useTheme } from '@/theme';
import { autofill } from '@/lib/autofill';

const CONFIRM_WORD = 'DELETE';

/** Delete account (S19): type DELETE, re-authenticate if the login is old, then the server deletes everything. */
export default function DeleteAccount() {
  const { spacing } = useTheme();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const { busy, error, run, clearError } = useAuthAction<'delete' | 'reauth'>();
  const store = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  // On success the user is signed out and the auth gate shows Welcome.
  // A stale login comes back as 'requires-recent-login' and shows "Sign in again".
  const onDelete = () => void run('delete', deleteAccount);

  const reauthThenDelete = async () => {
    const method = reauthMethod(auth().currentUser);
    if (method === 'password' && !needsPassword) {
      setNeedsPassword(true);
      return;
    }
    const ok = await run('reauth', () =>
      reauthenticate(method === 'password' ? password : undefined),
    );
    if (!ok) return;
    setNeedsPassword(false);
    setPassword('');
    onDelete();
  };

  return (
    <Screen testID="screen-settings-delete-account">
      <ScreenHeader
        mode="nav"
        title="Delete account"
        onBack={() => router.back()}
        testID="screen-settings-delete-account-title"
      />
      <AuthScroll>
        <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
          <AppText variant="title" accessibilityRole="header">
            This can&apos;t be undone
          </AppText>
          <AppText variant="body" tone="ink2">
            Deleting your account permanently removes your receipts, warranties, photos and
            reminders.
          </AppText>
          <Banner
            kind="warn"
            message={`Deleting your account does not cancel a ReturnSafe Pro subscription. Cancel it in ${store} settings.`}
          />
          <TextField
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={typed}
            onChangeText={(t) => {
              setTyped(t);
              if (error) clearError();
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            testID="delete-confirm-input"
          />
          <FormError message={error?.message ?? null} />
          {error?.kind === 'requires-recent-login' ? (
            <Button
              label="Sign in again"
              variant="soft"
              onPress={() => void reauthThenDelete()}
              loading={busy === 'reauth'}
              testID="delete-reauth"
            />
          ) : null}
          <Button
            label="Delete my account"
            variant="danger"
            disabled={typed.trim() !== CONFIRM_WORD}
            loading={busy === 'delete'}
            onPress={onDelete}
            testID="delete-submit"
          />
        </View>
      </AuthScroll>
      <Sheet
        visible={needsPassword}
        onClose={() => setNeedsPassword(false)}
        title="Enter your password"
        testID="sheet-reauth"
      >
        <View style={{ gap: spacing.sm }}>
          <TextField
            label="Password"
            secure
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            {...autofill('current-password')}
            testID="reauth-password"
          />
          <FormError
            message={error && error.kind !== 'requires-recent-login' ? error.message : null}
          />
          <Button
            label="Continue"
            onPress={() => void reauthThenDelete()}
            disabled={password.length === 0}
            loading={busy === 'reauth'}
            testID="reauth-submit"
          />
        </View>
      </Sheet>
    </Screen>
  );
}
