import { View } from 'react-native';

import { AppText, Button, Sheet } from '@/components';
import { useTheme } from '@/theme';

type Props = {
  visible: boolean;
  /** False when there is no credential to sign in with (e.g. email already used by another account). */
  canSignIn: boolean;
  busy: boolean;
  onSignIn: () => void;
  onClose: () => void;
};

/** Guest tried to save with a login that belongs to another account. */
export function CredentialInUseSheet({ visible, canSignIn, busy, onSignIn, onClose }: Props) {
  const { spacing } = useTheme();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="That login already has an account"
      testID="sheet-credential-in-use"
    >
      <View style={{ gap: spacing.md }}>
        <AppText variant="body" tone="ink2">
          {canSignIn
            ? 'Sign in to that account instead? Receipts you saved as a guest will move to it.'
            : 'Log in to that account from the Welcome screen, or use a different email to save this one.'}
        </AppText>
        {canSignIn ? (
          <Button
            label="Sign in to that account"
            onPress={onSignIn}
            loading={busy}
            testID="credential-in-use-sign-in"
          />
        ) : null}
        <Button label="Cancel" variant="text" onPress={onClose} testID="credential-in-use-cancel" />
      </View>
    </Sheet>
  );
}
