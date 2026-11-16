/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Firebase: in-memory fakes (see src/test/fakeFirebase.js); native sign-in sheets are stubbed.
jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
jest.mock('@react-native-firebase/auth', () => require('./src/test/fakeFirebase').fakeAuth);
jest.mock(
  '@react-native-firebase/functions',
  () => require('./src/test/fakeFirebase').fakeFunctions,
);
jest.mock(
  '@react-native-firebase/firestore',
  () => require('./src/test/fakeFirestore').fakeFirestore,
);
// FlashList ships ES modules only; a FlatList renders the same rows in tests.
jest.mock('@shopify/flash-list', () => ({ FlashList: require('react-native').FlatList }));
jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  const Picker = (props) => createElement(View, props);
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});
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
