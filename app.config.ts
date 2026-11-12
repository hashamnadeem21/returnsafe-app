import type { ConfigContext, ExpoConfig } from 'expo/config';

type AppEnv = 'development' | 'production';

const APP_ENV: AppEnv = process.env.APP_ENV === 'production' ? 'production' : 'development';
const IS_PROD = APP_ENV === 'production';

// Dev builds use their own bundle ID so they can sit next to the store build on one phone.
const BUNDLE_ID = IS_PROD ? 'com.returnsafe.app' : 'com.returnsafe.app.dev';
const FIREBASE_DIR = `./firebase/${IS_PROD ? 'prod' : 'dev'}`;

const BRAND_TEAL = '#0F766E';

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
    [
      'expo-build-properties',
      {
        // React Native Firebase requires dynamic frameworks; "static" breaks pod install.
        ios: { useFrameworks: 'dynamic', deploymentTarget: '16.4' },
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
