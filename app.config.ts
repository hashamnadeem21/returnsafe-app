import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

type AppEnv = 'development' | 'production';

const APP_ENV: AppEnv = process.env.APP_ENV === 'production' ? 'production' : 'development';
const IS_PROD = APP_ENV === 'production';

const BUNDLE_ID = 'com.returnsafe.app';
const FIREBASE_DIR = `./firebase/${IS_PROD ? 'prod' : 'dev'}`;
// EAS Build passes the git-ignored Firebase files as file env vars (see docs/releasing.md).
const IOS_FIREBASE_FILE =
  process.env.GOOGLE_SERVICES_PLIST ?? `${FIREBASE_DIR}/GoogleService-Info.plist`;
const ANDROID_FIREBASE_FILE =
  process.env.GOOGLE_SERVICES_JSON ?? `${FIREBASE_DIR}/google-services.json`;

const BRAND_TEAL = '#0F766E';

/**
 * EAS project id (from `eas init`). Over-the-air updates stay off until it is set, so builds made
 * before the project is linked never look for updates.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

/** A data type the app collects, as declared in the iOS privacy manifest. */
const collected = (type: string, purposes: string[]) => ({
  NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
  NSPrivacyCollectedDataTypeLinked: type !== 'CrashData' && type !== 'ProductInteraction',
  NSPrivacyCollectedDataTypeTracking: false,
  NSPrivacyCollectedDataTypePurposes: purposes.map((p) => `NSPrivacyCollectedDataTypePurpose${p}`),
});

const CAMERA_USAGE = 'ReturnSafe uses the camera to scan your receipts.';
const PHOTOS_USAGE = 'ReturnSafe uses your photo library to add a receipt photo.';

/**
 * Google Sign-In on iOS needs the REVERSED_CLIENT_ID URL scheme from GoogleService-Info.plist.
 * The plist only contains it once the Google provider is enabled in the Firebase console;
 * until then the Google Sign-In plugin is left out so prebuild still works.
 */
function readIosGoogleUrlScheme(): string | undefined {
  const plist = isAbsolute(IOS_FIREBASE_FILE)
    ? IOS_FIREBASE_FILE
    : join(__dirname, IOS_FIREBASE_FILE);
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
  // A JavaScript-only update reaches only builds with the same app version (same native code).
  runtimeVersion: { policy: 'appVersion' },
  updates: EAS_PROJECT_ID
    ? { url: `https://u.expo.dev/${EAS_PROJECT_ID}`, checkAutomatically: 'ON_LOAD' }
    : { enabled: false },
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    googleServicesFile: IOS_FIREBASE_FILE,
    // Sign in with Apple capability (set directly; usesAppleSignIn needs expo-apple-authentication).
    entitlements: {
      'com.apple.developer.applesignin': ['Default'],
      // Push notifications for reminders (APNs). Store builds use the production environment.
      'aps-environment': IS_PROD ? 'production' : 'development',
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['remote-notification'],
    },
    // The app's own privacy manifest. Each SDK ships its own as well; `npm run check:privacy`
    // lists every manifest in a built app. No tracking, and nothing is sold or shared.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1', 'C56D.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
      NSPrivacyCollectedDataTypes: [
        collected('EmailAddress', ['AppFunctionality']),
        collected('Name', ['AppFunctionality']),
        collected('UserID', ['AppFunctionality']),
        collected('PhotosorVideos', ['AppFunctionality']),
        collected('PurchaseHistory', ['AppFunctionality']),
        collected('OtherUserContent', ['AppFunctionality']),
        collected('CrashData', ['AppFunctionality']),
        collected('ProductInteraction', ['Analytics']),
      ],
    },
  },
  android: {
    package: BUNDLE_ID,
    googleServicesFile: ANDROID_FIREBASE_FILE,
    adaptiveIcon: {
      backgroundColor: BRAND_TEAL,
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Android 13+ asks for this at run time, after the notification primer.
    permissions: ['android.permission.POST_NOTIFICATIONS'],
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
    // Crash reports (Crashlytics uploads iOS dSYMs in a build phase) and usage events.
    '@react-native-firebase/crashlytics',
    // Analytics without the advertising-ID (IDFA) SDKs: no tracking, no ATT prompt.
    ['@react-native-firebase/analytics', { ios: { withoutAdIdSupport: true } }],
    'expo-updates',
    // Reminder pushes. The white icon and its teal colour ship in modules/reminder-notifications.
    [
      '@react-native-firebase/messaging',
      { android: { notificationIcon: 'notification_icon', notificationColor: BRAND_TEAL } },
    ],
    '@react-native-community/datetimepicker',
    // Export (S20) hands the PDF or CSV to the system share sheet.
    'expo-sharing',
    // Receipt scanning: VisionKit (iOS) / ML Kit Document Scanner (Android), plus the photo library.
    ['react-native-document-scanner-plugin', { cameraPermission: CAMERA_USAGE }],
    [
      'expo-image-picker',
      {
        cameraPermission: CAMERA_USAGE,
        photosPermission: PHOTOS_USAGE,
        microphonePermission: false,
      },
    ],
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
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});
