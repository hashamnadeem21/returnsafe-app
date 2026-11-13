/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Firebase: in-memory fakes (see src/test/fakeFirebase.js); native sign-in sheets are stubbed.
jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
jest.mock('@react-native-firebase/auth', () => require('./src/test/fakeFirebase').fakeAuth);
jest.mock(
  '@react-native-firebase/functions',
  () => require('./src/test/fakeFirebase').fakeFunctions,
);
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  connectFirestoreEmulator: jest.fn(),
  terminate: jest.fn(async () => undefined),
  clearPersistence: jest.fn(async () => undefined),
}));
jest.mock('@react-native-firebase/app-check', () => ({
  initializeAppCheck: jest.fn(async () => undefined),
  ReactNativeFirebaseAppCheckProvider: class {
    configure() {}
  },
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'cancelled', data: null })),
    signOut: jest.fn(async () => undefined),
  },
  isSuccessResponse: (r) => r.type === 'success',
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));
jest.mock('@invertase/react-native-apple-authentication', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return {
    appleAuth: { isSupported: true, performRequest: jest.fn(), Operation: {}, Scope: {} },
    // Mirrors the real runtime shape: Style/Type hang off AppleButton (no AppleButtonStyle export).
    AppleButton: Object.assign(
      (props) =>
        createElement(Text, { testID: props.testID, onPress: props.onPress }, 'Sign in with Apple'),
      {
        Style: { BLACK: 'Black', WHITE: 'White' },
        Type: { SIGN_IN: 'SignIn', CONTINUE: 'Continue' },
      },
    ),
  };
});
jest.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'America/New_York' }] }));
