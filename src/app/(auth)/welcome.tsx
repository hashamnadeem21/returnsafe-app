import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { useTheme } from '@/theme';

import logo from '../../../assets/images/logo-mark.png';

/**
 * Welcome (S03). Phase 1 shell: Apple/Google sign-in and guest auth arrive in Phase 2.
 * "Continue as guest" goes straight to the tabs until then.
 */
export default function Welcome() {
  const { spacing } = useTheme();
  return (
    <Screen testID="screen-welcome">
      <View style={[styles.hero, { paddingHorizontal: spacing.xxl, gap: spacing.md + 2 }]}>
        <Image source={logo} style={styles.logo} accessibilityLabel="ReturnSafe logo" />
        <AppText
          variant="display"
          align="center"
          accessibilityRole="header"
          style={{ marginTop: spacing.sm }}
        >
          Never miss a return again
        </AppText>
        <AppText variant="body" tone="ink2" align="center">
          Save your receipts and get reminded before return windows close.
        </AppText>
      </View>
      <View style={{ paddingHorizontal: spacing.xxl, gap: spacing.md, paddingBottom: spacing.lg }}>
        <Button
          label="Continue with email"
          variant="secondary"
          icon="mail"
          onPress={() => router.push('/sign-up')}
          testID="welcome-email"
        />
        <Button
          label="Continue as guest"
          variant="text"
          onPress={() => router.replace('/home')}
          testID="welcome-guest"
        />
        <AppText variant="caption" align="center">
          By continuing you agree to our Terms and Privacy Policy.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 96, height: 96, borderRadius: 21 },
});
