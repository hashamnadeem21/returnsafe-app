import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

type AppEnv = 'development' | 'production';

const APP_ENV: AppEnv = process.env.APP_ENV === 'production' ? 'production' : 'development';
const IS_PROD = APP_ENV === 'production';

const BUNDLE_ID = 'com.returnsafe.app';
const FIREBASE_DIR = `./firebase/${IS_PROD ? 'prod' : 'dev'}`;

const BRAND_TEAL = '#0F766E';

/**
 * Google Sign-In on iOS needs the REVERSED_CLIENT_ID URL scheme from GoogleService-Info.plist.
 * The plist only contains it once the Google provider is enabled in the Firebase console;
 * until then the Google Sign-In plugin is left out so prebuild still works.
 */
function readIosGoogleUrlScheme(): string | undefined {
  const plist = join(__dirname, FIREBASE_DIR, 'GoogleService-Info.plist');
  if (!existsSync(plist)) return undefined;
  const match = readFileSync(plist, 'utf8').match(
    /<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/,
  );
  return match?.[1];
}
const IOS_GOOGLE_URL_SCHEME = readIosGoogleUrlScheme();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PROD ? 'ReturnSafe' : 'ReturnSafe Dev',
  slug: 'returnsafe',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'returnsafe',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    googleServicesFile: `${FIREBASE_DIR}/GoogleService-Info.plist`,
    // Sign in with Apple capability (set directly; usesAppleSignIn needs expo-apple-authentication).
    entitlements: { 'com.apple.developer.applesignin': ['Default'] },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    googleServicesFile: `${FIREBASE_DIR}/google-services.json`,
    adaptiveIcon: {
      backgroundColor: BRAND_TEAL,
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: BRAND_TEAL,
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/app-check',
    '@react-native-community/datetimepicker',
    ...(IOS_GOOGLE_URL_SCHEME
      ? [
          [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: IOS_GOOGLE_URL_SCHEME },
          ] as [string, object],
        ]
      : []),
    [
      'expo-build-properties',
      {
        // React Native Firebase requires dynamic frameworks; "static" breaks pod install.
        ios: { useFrameworks: 'dynamic', deploymentTarget: '16.4' },
        // E2E builds talk to the local Firebase emulators over plain HTTP; never in store builds.
        android: {
          usesCleartextTraffic: process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === '1',
          // firebase-auth 25 (React Native Firebase 27) is compiled with Kotlin 2.4.
          kotlinVersion: '2.4.0',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appEnv: APP_ENV,
  },
});
