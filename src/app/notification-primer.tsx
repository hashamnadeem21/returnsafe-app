import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Icon, Screen } from '@/components';
import { useSession } from '@/stores/session';
import { useTheme } from '@/theme';

/**
 * Notification primer (S07), shown once after sign-up, before Home.
 * UI only for now: asking for the OS permission is wired up in Phase 5.
 */
export default function NotificationPrimer() {
  const { colors, spacing, radii } = useTheme();
  const setShowPrimer = useSession((s) => s.setShowPrimer);

  const done = () => {
    setShowPrimer(false);
    router.replace('/home');
  };

  return (
    <Screen testID="screen-notification-primer">
      <View style={[styles.body, { paddingHorizontal: spacing.xxl, gap: spacing.md }]}>
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.primarySoft, borderRadius: radii.card * 2 },
          ]}
        >
          <Icon name="bell" size={44} color={colors.primary} />
        </View>
        <AppText variant="display" align="center" accessibilityRole="header">
          Get reminded before it&apos;s too late
        </AppText>
        <AppText variant="body" tone="ink2" align="center">
          We&apos;ll send a reminder a few days before a return window closes, so you never miss it.
        </AppText>
      </View>
      <View style={{ paddingHorizontal: spacing.xxl, gap: spacing.md, paddingBottom: spacing.lg }}>
        <Button label="Turn on reminders" icon="bell" onPress={done} testID="primer-enable" />
        <Button label="Not now" variant="text" onPress={done} testID="primer-skip" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
});
