import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { mapAuthError, resetSentMessage } from '@/features/auth/errors';
import { logInSchema, passwordSchema, signUpSchema } from '@/features/auth/schemas';
import { INSTALL_KEY } from '@/lib/install';
import { ONBOARDING_KEY } from '@/lib/onboarding';
import { useSession } from '@/stores/session';
import { fakeState, reset, signInAnonymously } from '@/test/firebase';

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true, null],
  Inter_400Regular: 1,
  Inter_500Medium: 1,
  Inter_600SemiBold: 1,
  Inter_700Bold: 1,
  Inter_800ExtraBold: 1,
}));

const APP_DIR = 'src/app';
const PASSWORD_ERROR = 'Use at least 8 characters with a number';

async function start(url: string) {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  return renderRouter(APP_DIR, { initialUrl: url });
}

async function type(testID: string, text: string) {
  await fireEvent.changeText(screen.getByTestId(testID), text);
}

beforeEach(async () => {
  reset();
  useSession.setState({ ready: false, user: null, showPrimer: false });
  await AsyncStorage.clear();
  await AsyncStorage.setItem(INSTALL_KEY, '1');
});

describe('schemas', () => {
  it('TC-202: password "abc" is rejected with the help text', () => {
    const r = passwordSchema.safeParse('abc');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(PASSWORD_ERROR);
  });

  it('accepts a valid sign-up and rejects bad emails and number-less passwords', () => {
    expect(signUpSchema.safeParse({ email: 'a@b.co', password: 'Test1234' }).success).toBe(true);
    expect(signUpSchema.safeParse({ email: 'not-an-email', password: 'Test1234' }).success).toBe(
      false,
    );
    expect(signUpSchema.safeParse({ email: 'a@b.co', password: 'abcdefgh' }).success).toBe(false);
    expect(logInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});

describe('error mapping', () => {
  it('wrong password and unknown user give the same message', () => {
    const a = mapAuthError({ code: 'auth/wrong-password' }).message;
    const b = mapAuthError({ code: 'auth/user-not-found' }).message;
    const c = mapAuthError({ code: 'auth/invalid-credential' }).message;
    expect(a).toBe('Email or password is incorrect');
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('names the provider to use for account-exists-with-different-credential', () => {
    const code = { code: 'auth/account-exists-with-different-credential' };
    expect(mapAuthError(code, 'google').message).toBe('This email uses Google sign-in');
    expect(mapAuthError(code, 'apple').message).toBe('This email uses Apple sign-in');
  });

  it('maps network errors and treats cancelled sheets as cancelled', () => {
    expect(mapAuthError({ code: 'auth/network-request-failed' }).message).toMatch(/No internet/);
    expect(mapAuthError({ code: '1001' }).kind).toBe('cancelled');
    expect(mapAuthError({ code: 'SIGN_IN_CANCELLED' }).kind).toBe('cancelled');
    expect(mapAuthError({ code: 'something/odd' }).kind).toBe('unknown');
  });
});

describe('auth screens', () => {
  it('a fresh install signs out a login left in the iOS Keychain', async () => {
    await signInAnonymously();
    await AsyncStorage.removeItem(INSTALL_KEY);
    await start('/');
    expect(await screen.findByTestId('screen-welcome')).toBeTruthy();
    expect(fakeState.currentUser).toBeNull();
  });

  it('TC-202: typing "abc" shows the inline error and keeps Create account disabled', async () => {
    await start('/sign-up');
    await type('signup-email', 'new@example.com');
    await type('signup-password', 'abc');
    expect(await screen.findByText(PASSWORD_ERROR)).toBeTruthy();
    expect(screen.getByTestId('signup-submit')).toBeDisabled();
    await type('signup-password', 'Test1234');
    await waitFor(() => expect(screen.getByTestId('signup-submit')).toBeEnabled());
  });

  it('TC-201 (unit): sign-up opens the primer, then Home, and creates the user doc', async () => {
    await start('/sign-up');
    await type('signup-email', 'new@example.com');
    await type('signup-password', 'Test1234');
    await waitFor(() => expect(screen.getByTestId('signup-submit')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('screen-notification-primer')).toBeTruthy();
    expect(fakeState.callables.map((c) => c.name)).toContain('initUser');
    await fireEvent.press(screen.getByTestId('primer-skip'));
    expect(await screen.findByTestId('screen-home')).toBeTruthy();
  });

  it('TC-203 (unit): existing email shows the message and a Log in link', async () => {
    fakeState.accounts.set('taken@example.com', { password: 'Test1234', user: {} });
    await start('/sign-up');
    await type('signup-email', 'taken@example.com');
    await type('signup-password', 'Test1234');
    await waitFor(() => expect(screen.getByTestId('signup-submit')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByText('An account with this email already exists')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('signup-error-action'));
    expect(await screen.findByTestId('screen-log-in')).toBeTruthy();
  });

  it('TC-204 (unit): wrong password shows the shared message and keeps the email', async () => {
    fakeState.accounts.set('me@example.com', { password: 'Test1234', user: {} });
    await start('/log-in');
    await type('login-email', 'me@example.com');
    await type('login-password', 'Wrong999');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Email or password is incorrect')).toBeTruthy();
    expect(screen.getByTestId('login-email').props.value).toBe('me@example.com');
    expect(screen.getByTestId('login-password').props.value).toBe('');
  });

  it('TC-205 (unit): reset shows the same neutral message for unknown and known emails', async () => {
    fakeState.accounts.set('known@example.com', { password: 'Test1234', user: {} });
    for (const email of ['nobody@example.com', 'known@example.com']) {
      const view = await start('/forgot-password');
      await type('forgot-email', email);
      await fireEvent.press(screen.getByTestId('forgot-submit'));
      expect(await screen.findByTestId('forgot-message')).toHaveTextContent(
        resetSentMessage(email),
      );
      expect(screen.getByTestId('forgot-resend')).toBeDisabled();
      view.unmount();
    }
  });

  it('TC-209 (unit): guest saves the account with email and keeps the same uid', async () => {
    await start('/welcome');
    await fireEvent.press(screen.getByTestId('welcome-guest'));
    expect(await screen.findByTestId('screen-home')).toBeTruthy();
    const guestUid = fakeState.currentUser?.uid;
    await fireEvent.press(screen.getByTestId('tab-settings'));
    await fireEvent.press(await screen.findByTestId('settings-account'));
    expect(await screen.findByTestId('account-guest')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('account-save-email'));
    await type('signup-email', 'saved@example.com');
    await type('signup-password', 'Test1234');
    await waitFor(() => expect(screen.getByTestId('signup-submit')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('account-email')).toHaveTextContent('saved@example.com');
    expect(fakeState.currentUser?.uid).toBe(guestUid);
    expect(fakeState.currentUser?.isAnonymous).toBe(false);
    // The verify-email note appears without leaving and reopening Account.
    expect(screen.getByTestId('account-verify-banner')).toBeTruthy();
  });

  it('guest who signs in to an existing account leaves Save account', async () => {
    fakeState.accounts.set('taken@example.com', {
      password: 'Test1234',
      user: { uid: 'existing', email: 'taken@example.com', isAnonymous: false, providerData: [] },
    });
    await signInAnonymously();
    await start('/settings/account');
    await fireEvent.press(await screen.findByTestId('account-save-email'));
    await type('signup-email', 'taken@example.com');
    await type('signup-password', 'Test1234');
    await waitFor(() => expect(screen.getByTestId('signup-submit')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('signup-submit'));
    await fireEvent.press(await screen.findByTestId('credential-in-use-sign-in'));
    expect(await screen.findByTestId('screen-settings-account')).toBeTruthy();
    expect(screen.queryByTestId('signup-submit')).toBeNull();
    expect(fakeState.currentUser?.uid).toBe('existing');
  });

  it('a session restored at launch retries the user doc', async () => {
    await signInAnonymously();
    await start('/');
    expect(await screen.findByTestId('screen-home')).toBeTruthy();
    await waitFor(() => expect(fakeState.callables.map((c) => c.name)).toContain('initUser'));
  });

  it('shows why a name over 60 characters is rejected', async () => {
    await start('/sign-up');
    await type('signup-name', 'N'.repeat(61));
    await type('signup-email', 'new@example.com');
    await type('signup-password', 'Test1234');
    expect(await screen.findByTestId('signup-submit')).toBeDisabled();
    expect(screen.getByText('Keep your name under 60 characters')).toBeTruthy();
  });

  it('TC-210 (unit): after sign-out, Home cannot be reached', async () => {
    await signInAnonymously();
    fakeState.currentUser!.isAnonymous = false;
    await start('/settings/account');
    await fireEvent.press(await screen.findByTestId('account-sign-out'));
    expect(await screen.findByTestId('screen-welcome')).toBeTruthy();
    await act(() => router.push('/home'));
    expect(screen.queryByTestId('screen-home')).toBeNull();
    expect(screen.getByTestId('screen-welcome')).toBeTruthy();
  });

  it('Delete account stays disabled until DELETE is typed, then signs out', async () => {
    await signInAnonymously();
    await start('/settings/delete-account');
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
    await type('delete-confirm-input', 'DELETE');
    await fireEvent.press(screen.getByTestId('delete-submit'));
    expect(await screen.findByTestId('screen-welcome')).toBeTruthy();
    expect(fakeState.callables.map((c) => c.name)).toContain('deleteAccount');
  });
});
