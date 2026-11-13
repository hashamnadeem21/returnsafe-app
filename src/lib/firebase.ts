import { getApp } from '@react-native-firebase/app';
import {
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import { Platform } from 'react-native';

/** Build-time switch for E2E/dev: talk to the local Firebase Emulator Suite instead of the cloud. */
export const USE_EMULATORS = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === '1';

/** Android emulators reach the host machine on 10.0.2.2; iOS simulators use localhost. */
const EMULATOR_HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';

export const FUNCTIONS_REGION = 'us-central1';

let configured = false;

/** Call once at startup, before any auth/firestore/functions use. Safe to call again. */
export async function configureFirebase(): Promise<void> {
  if (configured) return;
  configured = true;
  const app = getApp();

  if (USE_EMULATORS) {
    connectAuthEmulator(getAuth(app), `http://${EMULATOR_HOST}:9099`);
    connectFirestoreEmulator(getFirestore(app), EMULATOR_HOST, 8180);
    connectFunctionsEmulator(getFunctions(app, FUNCTIONS_REGION), EMULATOR_HOST, 5001);
    return;
  }

  // App Check: debug provider in development builds, App Attest / Play Integrity in release.
  try {
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
      apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
    });
    await initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  } catch (e) {
    // App Check must never block sign-in; enforcement happens server-side.
    console.warn('App Check init failed', e);
  }
}

export const auth = () => getAuth(getApp());
export const db = () => getFirestore(getApp());
export const functions = () => getFunctions(getApp(), FUNCTIONS_REGION);
