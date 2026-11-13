import type { TextInputProps } from 'react-native';

import { USE_EMULATORS } from './firebase';

type AutofillKind = 'username' | 'new-password' | 'current-password';

const PROPS: Record<AutofillKind, Pick<TextInputProps, 'autoComplete' | 'textContentType'>> = {
  username: { autoComplete: 'email', textContentType: 'username' },
  'new-password': { autoComplete: 'new-password', textContentType: 'newPassword' },
  'current-password': { autoComplete: 'current-password', textContentType: 'password' },
};

/**
 * Password-manager hints for login fields (strong-password suggestions, "Save Password?").
 * Turned off in emulator/E2E builds: the iOS sheets cover the form and block automated tests.
 */
export function autofill(
  kind: AutofillKind,
): Pick<TextInputProps, 'autoComplete' | 'textContentType'> {
  if (!USE_EMULATORS) return PROPS[kind];
  // iOS still offers a strong password on any secure field after an email field unless the field
  // is marked as a one-time code; that is the only hint that switches the cover off.
  return kind === 'username'
    ? { autoComplete: 'off', textContentType: 'none' }
    : { autoComplete: 'off', textContentType: 'oneTimeCode' };
}
