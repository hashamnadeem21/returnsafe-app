/** Friendly copy for every Firebase Auth error the app can hit. Never reveals whether an email exists on log in. */
export type AuthErrorKind =
  | 'credentials'
  | 'email-in-use'
  | 'other-provider'
  | 'weak-password'
  | 'invalid-email'
  | 'network'
  | 'too-many-requests'
  | 'disabled'
  | 'requires-recent-login'
  | 'credential-in-use'
  | 'cancelled'
  | 'unknown';

export type FriendlyAuthError = {
  kind: AuthErrorKind;
  message: string;
  /** For 'other-provider': the method the user signed up with. */
  provider?: 'google' | 'apple' | 'password';
};

export const MESSAGES: Record<AuthErrorKind, string> = {
  credentials: 'Email or password is incorrect',
  'email-in-use': 'An account with this email already exists',
  'other-provider': 'This email uses a different sign-in method',
  'weak-password': 'Use at least 8 characters with a number',
  'invalid-email': 'Enter a valid email address',
  network: 'No internet connection. Check your connection and try again.',
  'too-many-requests': 'Too many attempts. Wait a minute and try again.',
  disabled: 'This account has been disabled. Contact support.',
  'requires-recent-login': 'For your security, sign in again to continue.',
  'credential-in-use': 'That login already belongs to another account',
  cancelled: '',
  unknown: 'Something went wrong. Please try again.',
};

const CODE_TO_KIND: Record<string, AuthErrorKind> = {
  'auth/wrong-password': 'credentials',
  'auth/user-not-found': 'credentials',
  'auth/invalid-credential': 'credentials',
  'auth/invalid-login-credentials': 'credentials',
  'auth/email-already-in-use': 'email-in-use',
  'auth/account-exists-with-different-credential': 'other-provider',
  'auth/weak-password': 'weak-password',
  'auth/invalid-email': 'invalid-email',
  'auth/missing-email': 'invalid-email',
  'auth/network-request-failed': 'network',
  'auth/too-many-requests': 'too-many-requests',
  'auth/user-disabled': 'disabled',
  'auth/requires-recent-login': 'requires-recent-login',
  'auth/credential-already-in-use': 'credential-in-use',
  'auth/provider-already-linked': 'credential-in-use',
  // Native sign-in sheets
  'auth/cancelled': 'cancelled',
  '1001': 'cancelled', // Apple: ASAuthorizationError.canceled
  SIGN_IN_CANCELLED: 'cancelled', // Google (Android)
  '-5': 'cancelled', // Google (iOS)
  '12501': 'cancelled', // Google (Android legacy)
};

export function codeOf(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error)
    return String((error as { code: unknown }).code);
  return '';
}

export function mapAuthError(
  error: unknown,
  provider?: FriendlyAuthError['provider'],
): FriendlyAuthError {
  const kind = CODE_TO_KIND[codeOf(error)] ?? 'unknown';
  if (kind === 'other-provider') {
    const name =
      provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : 'email and password';
    return { kind, provider, message: `This email uses ${name} sign-in` };
  }
  return { kind, message: MESSAGES[kind] };
}

/** Neutral reset copy: identical whether or not the email has an account. */
export function resetSentMessage(email: string): string {
  return `If an account exists for ${email}, we sent a link to reset your password.`;
}
