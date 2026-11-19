import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  DarkTheme,
  DefaultTheme,
  ErrorBoundary as RouterErrorBoundary,
  Stack,
  ThemeProvider as NavigationThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SnackbarHost } from '@/components';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { OnboardingProvider, useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { ReceiptsProvider } from '@/features/receipts/ReceiptsProvider';
import { ReminderPush } from '@/features/reminders/ReminderPush';
import { PurchasesProvider } from '@/features/subscription/PurchasesProvider';
import { useSession } from '@/stores/session';
import { ThemeProvider, useTheme } from '@/theme';
import { watchNetwork } from '@/lib/network';
import { reportError } from '@/lib/telemetry';

void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors, scheme } = useTheme();
  const { ready } = useOnboarding();
  const sessionReady = useSession((st) => st.ready);
  const signedIn = useSession((st) => st.user !== null);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const appReady = ready && sessionReady && (fontsLoaded || fontError !== null);
  // React Navigation's own theme (headers, cards, modal backdrops) follows the app palette.
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.surface,
        text: colors.ink,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [scheme, colors]);

  useEffect(() => {
    if (appReady) void SplashScreen.hideAsync();
  }, [appReady]);

  // Drives the "You're offline" banner.
  useEffect(() => watchNetwork(), []);

  // Hold the native splash until fonts, the onboarding flag and the saved login are loaded.
  if (!appReady) return null;

  return (
    <NavigationThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="notification-primer" options={{ gestureEnabled: false }} />
          <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
          <Stack.Screen name="receipt/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="receipt/[id]/index" />
          <Stack.Screen name="receipt/[id]/edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings/reminders" />
          <Stack.Screen name="settings/account" />
          <Stack.Screen name="settings/save-account" />
          <Stack.Screen name="settings/delete-account" />
        </Stack.Protected>
      </Stack>
      {signedIn ? <ReminderPush /> : null}
      <SnackbarHost />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

/**
 * Render errors show Expo Router's retry screen instead of crashing the app, and are reported to
 * Crashlytics (real builds only).
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  useEffect(() => reportError(props.error, 'render'), [props.error]);
  return <RouterErrorBoundary {...props} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OnboardingProvider>
          <SessionProvider>
            <PurchasesProvider>
              <ReceiptsProvider>
                <RootStack />
              </ReceiptsProvider>
            </PurchasesProvider>
          </SessionProvider>
        </OnboardingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
