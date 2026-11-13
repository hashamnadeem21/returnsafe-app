import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OnboardingProvider, useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors, scheme } = useTheme();
  const { ready } = useOnboarding();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const appReady = ready && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (appReady) void SplashScreen.hideAsync();
  }, [appReady]);

  // Hold the native splash until fonts and the onboarding flag are loaded.
  if (!appReady) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="receipt/new" />
        <Stack.Screen name="receipt/[id]/index" />
        <Stack.Screen name="receipt/[id]/edit" />
        <Stack.Screen name="settings/reminders" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/delete-account" />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OnboardingProvider>
          <RootStack />
        </OnboardingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
