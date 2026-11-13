import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type AuthCredential,
  type User,
} from '@react-native-firebase/auth';
import { clearPersistence, terminate } from '@react-native-firebase/firestore';
import { httpsCallable } from '@react-native-firebase/functions';
import * as Localization from 'expo-localization';

import { auth, db, functions } from '@/lib/firebase';
import { INSTALL_KEY } from '@/lib/install';
import { ONBOARDING_KEY } from '@/lib/onboarding';
import { useSession } from '@/stores/session';

import { codeOf, mapAuthError, type FriendlyAuthError } from './errors';
import {
  getAppleCredential,
  getGoogleCredential,
  ProviderNotConfigured,
  signOutProviders,
  type ProviderResult,
} from './providers';

export type AuthMethod = 'google' | 'apple' | 'password';

/** Thrown to the UI with friendly copy attached. */
export class AuthError extends Error {
  constructor(
    public readonly friendly: FriendlyAuthError,
    public readonly cause?: unknown,
  ) {
    super(friendly.message);
  }
}

/** A guest tried to save their account with a login that already belongs to someone else. */
export class CredentialInUseError extends AuthError {
  constructor(
    public readonly credential: AuthCredential | null,
    cause?: unknown,
  ) {
    super(mapAuthError({ code: 'auth/credential-already-in-use' }), cause);
  }
}

function deviceTimezone(): string {
  return Localization.getCalendars()[0]?.timeZone ?? 'America/New_York';
}

/** Creates users/{uid} with server-side defaults on first sign-in (idempotent). */
export async function ensureUserDoc(displayName?: string): Promise<void> {
  const initUser = httpsCallable<{ timezone: string; displayName?: string }, { created: boolean }>(
    functions(),
    'initUser',
  );
  await initUser({ timezone: deviceTimezone(), ...(displayName ? { displayName } : {}) });
}

async function methodForEmail(email: string): Promise<AuthMethod | undefined> {
  try {
    const methods = await fetchSignInMethodsForEmail(auth(), email);
    if (methods.includes('google.com')) return 'google';
    if (methods.includes('apple.com')) return 'apple';
    if (methods.includes('password')) return 'password';
  } catch {
    // Email enumeration protection may hide methods; fall back to the generic message.
  }
  return undefined;
}

async function wrap<T>(fn: () => Promise<T>, provider?: AuthMethod): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if (e instanceof ProviderNotConfigured) {
      throw new AuthError({ kind: 'unknown', message: e.message }, e);
    }
    throw new AuthError(mapAuthError(e, provider), e);
  }
}

/**
 * Linking a guest or updating the profile keeps the same uid, so onAuthStateChanged does not fire.
 * Push the fresh user into the session store so the UI updates straight away.
 */
function syncSession(): void {
  useSession.getState().setUser(auth().currentUser);
}

function currentGuest(): User | null {
  const user = auth().currentUser;
  return user?.isAnonymous ? user : null;
}

/** Links to the guest when there is one (uid unchanged), otherwise signs in. */
async function linkOrSignIn(credential: AuthCredential) {
  const guest = currentGuest();
  if (!guest) return signInWithCredential(auth(), credential);
  try {
    return await linkWithCredential(guest, credential);
  } catch (e) {
    const code = codeOf(e).replace(/^functions\//, '');
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
      throw new CredentialInUseError(
        code === 'auth/credential-already-in-use' ? credential : null,
        e,
      );
    }
    throw e;
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string,
): Promise<void> {
  await wrap(async () => {
    const guest = currentGuest();
    let user: User;
    try {
      user = guest
        ? (await linkWithCredential(guest, EmailAuthProvider.credential(email, password))).user
        : (await createUserWithEmailAndPassword(auth(), email, password)).user;
    } catch (e) {
      if (
        codeOf(e) === 'auth/email-already-in-use' ||
        codeOf(e) === 'auth/credential-already-in-use'
      ) {
        const method = await methodForEmail(email);
        if (method && method !== 'password') {
          throw new AuthError(
            mapAuthError({ code: 'auth/account-exists-with-different-credential' }, method),
            e,
          );
        }
        if (guest) throw new CredentialInUseError(EmailAuthProvider.credential(email, password), e);
        throw new AuthError(mapAuthError({ code: 'auth/email-already-in-use' }), e);
      }
      throw e;
    }
    if (name) await updateProfile(user, { displayName: name });
    await sendEmailVerification(user).catch(() => undefined);
    await ensureUserDoc(name);
    syncSession();
  });
}

export async function logInWithEmail(email: string, password: string): Promise<void> {
  await wrap(async () => {
    try {
      await signInWithEmailAndPassword(auth(), email, password);
    } catch (e) {
      const kind = mapAuthError(e).kind;
      if (kind === 'credentials') {
        const method = await methodForEmail(email);
        if (method === 'google' || method === 'apple') {
          throw new AuthError(
            mapAuthError({ code: 'auth/account-exists-with-different-credential' }, method),
            e,
          );
        }
      }
      throw e;
    }
    await ensureUserDoc();
  });
}

/** Always resolves for unknown emails too, so the UI can show the same neutral message. */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth(), email);
  } catch (e) {
    const kind = mapAuthError(e).kind;
    if (kind === 'network' || kind === 'too-many-requests' || kind === 'invalid-email') {
      throw new AuthError(mapAuthError(e), e);
    }
    // user-not-found and anything else: stay neutral.
  }
}

export async function continueAsGuest(): Promise<void> {
  await wrap(async () => {
    await signInAnonymously(auth());
    await ensureUserDoc();
  });
}

async function withProvider(method: 'google' | 'apple', get: () => Promise<ProviderResult>) {
  await wrap(async () => {
    const { credential, displayName } = await get();
    const result = await linkOrSignIn(credential);
    if (displayName && !result.user.displayName) {
      await updateProfile(result.user, { displayName });
    }
    await ensureUserDoc(displayName);
    syncSession();
  }, method);
}

export const signInWithGoogle = () => withProvider('google', getGoogleCredential);
export const signInWithApple = () => withProvider('apple', getAppleCredential);

/** Guest token waiting to be merged into the signed-in account, kept until the merge succeeds. */
export const PENDING_MERGE_KEY = 'rs.pendingMerge.v1';

async function mergeGuest(guestIdToken: string): Promise<void> {
  const merge = httpsCallable<{ guestIdToken: string }, { moved: number }>(
    functions(),
    'mergeGuestAccount',
  );
  await merge({ guestIdToken });
}

/**
 * Finishes work left over from an earlier sign-in: creates the user doc and retries a pending guest
 * merge. Safe to call repeatedly; failures stay pending for the next launch.
 */
export async function finishPendingSignIn(): Promise<void> {
  await ensureUserDoc().catch(() => undefined);
  const pending = await AsyncStorage.getItem(PENDING_MERGE_KEY).catch(() => null);
  if (!pending) return;
  try {
    await mergeGuest(pending);
    await AsyncStorage.removeItem(PENDING_MERGE_KEY);
  } catch (e) {
    // An expired or rejected guest token can never succeed; anything else is retried later.
    const code = codeOf(e).replace(/^functions\//, '');
    if (code === 'invalid-argument' || code === 'permission-denied') {
      await AsyncStorage.removeItem(PENDING_MERGE_KEY).catch(() => undefined);
    }
  }
}

/**
 * Guest chose to sign in to the existing account that owns the login.
 * Captures the guest's ID token first so the server can move guest data (Phase 3 implements the move).
 * Once the sign-in succeeds the action counts as done: the user doc and merge are finished here when
 * possible, and otherwise retried at the next launch, so the UI never repeats the sign-in.
 */
export async function signInToExistingAndMerge(credential: AuthCredential): Promise<void> {
  await wrap(async () => {
    const guest = currentGuest();
    const guestIdToken = guest ? await guest.getIdToken() : undefined;
    await signInWithCredential(auth(), credential);
    if (guestIdToken) await AsyncStorage.setItem(PENDING_MERGE_KEY, guestIdToken);
    syncSession();
  });
  await finishPendingSignIn();
}

/** Clears app caches so nothing from this account survives sign-out (onboarding and install flags are kept). */
async function clearLocalCaches(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k !== ONBOARDING_KEY && k !== INSTALL_KEY));
  try {
    await terminate(db());
    await clearPersistence(db());
  } catch {
    // Firestore may be in use; its cache is still scoped by security rules.
  }
}

export async function signOut(): Promise<void> {
  await signOutProviders();
  await fbSignOut(auth());
  await clearLocalCaches();
}

/** Which method to use when Firebase asks for a recent login before a sensitive action. */
export function reauthMethod(user: User | null): AuthMethod | 'none' {
  if (!user || user.isAnonymous) return 'none';
  const ids = user.providerData.map((p) => p.providerId);
  if (ids.includes('apple.com')) return 'apple';
  if (ids.includes('google.com')) return 'google';
  return 'password';
}

export async function reauthenticate(password?: string): Promise<void> {
  const user = auth().currentUser;
  if (!user) return;
  await wrap(async () => {
    const method = reauthMethod(user);
    if (method === 'none') return;
    const credential =
      method === 'password'
        ? EmailAuthProvider.credential(user.email ?? '', password ?? '')
        : (await (method === 'google' ? getGoogleCredential() : getAppleCredential())).credential;
    await reauthenticateWithCredential(user, credential);
  });
}

/** Server deletes Firestore data, Storage photos and the auth user. */
export async function deleteAccount(): Promise<void> {
  await wrap(async () => {
    const fn = httpsCallable<Record<string, never>, { deleted: boolean }>(
      functions(),
      'deleteAccount',
    );
    try {
      await fn({});
    } catch (e) {
      // The function reports a stale login as failed-precondition with this reason.
      const details = (e as { details?: { reason?: string } }).details;
      if (details?.reason === 'requires-recent-login') {
        throw new AuthError(mapAuthError({ code: 'auth/requires-recent-login' }), e);
      }
      throw e;
    }
    await fbSignOut(auth()).catch(() => undefined);
    await clearLocalCaches();
  });
}
