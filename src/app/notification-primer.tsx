import { router } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Screen } from '@/components';
import { requestPushPermission, usePushPermission } from '@/features/reminders/permission';
import { useSession } from '@/stores/session';
import { fonts, useTheme } from '@/theme';

import logo from '../../assets/images/logo-mark.png';

/**
 * Notification primer (S07), shown once after sign-up, before Home. It explains reminders first;
 * only "Turn on reminders" shows the system prompt. "Not now" never blocks the app: Home then
 * shows the "Reminders are off" banner.
 */
export default function NotificationPrimer() {
  const { colors, spacing, radii } = useTheme();
  const setShowPrimer = useSession((s) => s.setShowPrimer);
  const setPermission = usePushPermission((s) => s.set);
  const [asking, setAsking] = useState(false);

  const done = () => {
    setShowPrimer(false);
    router.replace('/home');
  };

  const turnOn = async () => {
    setAsking(true);
    try {
      setPermission(await requestPushPermission());
    } catch {
      // The prompt failing must not keep the user here.
    }
    done();
  };

  return (
    <Screen testID="screen-notification-primer">
      <View style={[styles.body, { paddingHorizontal: spacing.xxl, gap: spacing.md }]}>
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.primarySoft, borderRadius: radii.card * 4 },
          ]}
        >
          <Icon name="bell" size={52} color={colors.primary} />
        </View>
        <AppText variant="display" align="center" accessibilityRole="header">
          Never miss a deadline
        </AppText>
        <AppText variant="body" tone="ink2" align="center">
          We&apos;ll remind you the day before a return window closes. Pro members get reminders 7,
          3 and 1 day before.
        </AppText>
        <Card
          style={[styles.preview, { padding: spacing.md, gap: spacing.md, marginTop: spacing.sm }]}
          accessible
          accessibilityLabel="Example reminder: Target return closes in 2 days, $48.20, Kids sneakers, bath towels"
        >
          <Image source={logo} style={[styles.logo, { borderRadius: radii.chip }]} />
          <View style={styles.previewText}>
            <View style={styles.previewTop}>
              <AppText variant="caption">RETURNSAFE</AppText>
              <AppText variant="caption">9:00 AM</AppText>
            </View>
            <AppText variant="body" style={styles.previewTitle}>
              Target return closes in 2 days
            </AppText>
            <AppText variant="caption">$48.20 · Kids sneakers, bath towels</AppText>
          </View>
        </Card>
      </View>
      <View style={{ paddingHorizontal: spacing.xxl, gap: spacing.md, paddingBottom: spacing.lg }}>
        <Button
          label="Turn on reminders"
          icon="bell"
          onPress={() => void turnOn()}
          loading={asking}
          testID="primer-enable"
        />
        <Button label="Not now" variant="text" onPress={done} testID="primer-skip" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  logo: { width: 38, height: 38 },
  previewText: { flex: 1 },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between' },
  previewTitle: { fontFamily: fonts.semibold },
});
