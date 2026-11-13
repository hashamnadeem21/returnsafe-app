import { router } from 'expo-router';
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { continueAsGuest, signInWithApple, signInWithGoogle } from '@/features/auth/authService';
import { FormError } from '@/features/auth/ui/FormError';
import { SocialButtons } from '@/features/auth/ui/SocialButtons';
import { useAuthAction } from '@/features/auth/ui/useAuthAction';
import { PRIVACY_URL, TERMS_URL } from '@/lib/links';
import { useTheme } from '@/theme';

import logo from '../../../assets/images/logo-mark.png';

/** Welcome (S03): Apple (iOS), Google, email, or guest. The root auth gate moves on once signed in. */
export default function Welcome() {
  const { spacing } = useTheme();
  const { busy, error, run } = useAuthAction<'apple' | 'google' | 'guest'>();

  return (
    <Screen testID="screen-welcome">
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
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
        <View
          style={{ paddingHorizontal: spacing.xxl, gap: spacing.md, paddingBottom: spacing.lg }}
        >
          <FormError message={error?.message ?? null} />
          <SocialButtons
            busy={busy === 'apple' || busy === 'google' ? busy : null}
            disabled={busy !== null}
            onApple={() => void run('apple', signInWithApple)}
            onGoogle={() => void run('google', signInWithGoogle)}
          />
          <Button
            label="Continue with email"
            variant="secondary"
            icon="mail"
            disabled={busy !== null}
            onPress={() => router.push('/sign-up')}
            testID="welcome-email"
          />
          <Button
            label="Continue as guest"
            variant="text"
            loading={busy === 'guest'}
            disabled={busy !== null && busy !== 'guest'}
            onPress={() => void run('guest', continueAsGuest)}
            testID="welcome-guest"
          />
          <AppText variant="caption" align="center">
            By continuing you agree to our{' '}
            <AppText
              variant="caption"
              tone="primary"
              accessibilityRole="link"
              onPress={() => void Linking.openURL(TERMS_URL)}
            >
              Terms
            </AppText>{' '}
            and{' '}
            <AppText
              variant="caption"
              tone="primary"
              accessibilityRole="link"
              onPress={() => void Linking.openURL(PRIVACY_URL)}
            >
              Privacy Policy
            </AppText>
            .
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 96, height: 96, borderRadius: 21 },
});
