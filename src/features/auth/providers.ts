/**
 * Native sign-in sheets (Apple, Google) → Firebase credentials.
 * Kept apart from authService so tests can mock them without native modules.
 */
import { appleAuth } from '@invertase/react-native-apple-authentication';
import {
  AppleAuthProvider,
  GoogleAuthProvider,
  type AuthCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

export type ProviderResult = {
  credential: AuthCredential;
  /** Apple only sends the name on the very first authorisation; save it then. */
  displayName?: string;
};

export class SignInCancelled extends Error {
  code = 'auth/cancelled';
}

export class ProviderNotConfigured extends Error {
  code = 'auth/provider-not-configured';
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
let googleConfigured = false;

export const appleSignInAvailable = Platform.OS === 'ios' && appleAuth.isSupported;
export const googleSignInConfigured = Boolean(GOOGLE_WEB_CLIENT_ID);

export async function getGoogleCredential(): Promise<ProviderResult> {
  if (!GOOGLE_WEB_CLIENT_ID) throw new ProviderNotConfigured('Google sign-in is not set up yet');
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    googleConfigured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new SignInCancelled();
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google did not return an ID token');
  return {
    credential: GoogleAuthProvider.credential(idToken),
    displayName: response.data.user.name ?? undefined,
  };
}

export async function getAppleCredential(): Promise<ProviderResult> {
  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    // FULL_NAME first: Apple's sheet fails on some iOS versions when EMAIL comes first.
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
  });
  if (!response.identityToken) throw new Error('Apple did not return an identity token');
  const name = [response.fullName?.givenName, response.fullName?.familyName]
    .filter(Boolean)
    .join(' ');
  return {
    credential: AppleAuthProvider.credential(response.identityToken, response.nonce),
    displayName: name || undefined,
  };
}

export async function signOutProviders(): Promise<void> {
  if (googleConfigured) await GoogleSignin.signOut().catch(() => undefined);
}
