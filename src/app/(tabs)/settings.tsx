import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  Icon,
  LetterAvatar,
  ListRow,
  Pill,
  ProLock,
  Screen,
  ScreenHeader,
  useSnackbar,
} from '@/components';
import { ExportSheet } from '@/features/export/ExportSheet';
import { openManageSubscription, restore } from '@/features/subscription/purchases';
import { useIsPro } from '@/stores/pro';
import { useSession } from '@/stores/session';
import { fonts, useTheme } from '@/theme';

/** Settings (S16): account card with the plan, upgrade banner for Free users, then the rows. */
export default function Settings() {
  const { spacing, colors, radii, sizes } = useTheme();
  const user = useSession((s) => s.user);
  const isPro = useIsPro();
  const [exportOpen, setExportOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const guest = user?.isAnonymous ?? true;
  const title = guest ? 'Guest' : (user?.displayName ?? user?.email ?? 'Your account');
  const subtitle = guest
    ? 'Save your account to keep your receipts'
    : user?.displayName
      ? user.email
      : null;
  const chevron = <Icon name="right" size={20} color={colors.muted} />;
  const toast = (message: string) => useSnackbar.getState().show({ message, aboveTabBar: true });

  const onRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      toast((await restore()) ? 'Pro restored' : 'No ReturnSafe Pro purchase was found');
    } catch {
      toast("Couldn't restore purchases. Check your connection and try again.");
    } finally {
      setRestoring(false);
    }
  };

  const onManage = () =>
    void openManageSubscription().catch(() => toast("Couldn't open the store's subscriptions"));

  return (
    <Screen testID="screen-settings" bottom={false}>
      <ScreenHeader title="Settings" testID="screen-settings-title" />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg }}>
        <Card
          style={{
            padding: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
          testID="settings-profile"
        >
          <LetterAvatar letter={title} size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="headline" numberOfLines={1}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" numberOfLines={2}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {isPro ? (
            <Pill label="Pro" tone="teal" icon="spark" testID="settings-plan-pro" />
          ) : (
            <Pill label="Free" tone="gray" testID="settings-plan-free" />
          )}
        </Card>

        {isPro ? null : (
          <Pressable
            onPress={() => router.push('/paywall')}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Pro. Unlimited receipts and warranties"
            testID="settings-upgrade"
            style={({ pressed }) => [
              styles.upgrade,
              {
                backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                borderRadius: radii.card,
                padding: spacing.lg,
                gap: spacing.md,
                minHeight: sizes.tapTarget,
              },
            ]}
          >
            <Icon name="spark" size={24} color={colors.onPrimary} />
            <View style={{ flex: 1 }}>
              <AppText variant="body" style={{ color: colors.onPrimary, fontFamily: fonts.bold }}>
                Upgrade to Pro
              </AppText>
              <AppText variant="caption" style={{ color: colors.onPrimary }}>
                Unlimited receipts and warranties
              </AppText>
            </View>
            <Icon name="right" size={20} color={colors.onPrimary} />
          </Pressable>
        )}

        <Card style={{ overflow: 'hidden' }}>
          <ListRow
            title="Reminders"
            subtitle="When to get notified"
            letter="R"
            right={chevron}
            onPress={() => router.push('/settings/reminders')}
            testID="settings-reminders"
          />
          <ListRow
            title="Export receipts"
            subtitle="PDF or CSV"
            letter="E"
            right={
              isPro ? (
                chevron
              ) : (
                <View style={styles.lock}>
                  <ProLock />
                </View>
              )
            }
            divider
            accessibilityLabel={isPro ? 'Export receipts' : 'Export receipts, Pro feature'}
            onPress={() => (isPro ? setExportOpen(true) : router.push('/paywall'))}
            testID="settings-export"
          />
          <ListRow
            title="Restore purchases"
            subtitle="Already bought Pro on another phone?"
            letter="P"
            right={restoring ? <ActivityIndicator color={colors.ink2} /> : chevron}
            divider
            onPress={() => void onRestore()}
            testID="settings-restore"
          />
          <ListRow
            title="Manage subscription"
            subtitle="Change or cancel in the store"
            letter="M"
            right={chevron}
            divider
            onPress={onManage}
            testID="settings-manage"
          />
        </Card>

        <Card style={{ overflow: 'hidden' }}>
          <ListRow
            title="Account"
            subtitle={guest ? 'Guest account' : 'Sign out, delete account'}
            letter="A"
            right={chevron}
            onPress={() => router.push('/settings/account')}
            testID="settings-account"
          />
        </Card>
      </ScrollView>
      <ExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  upgrade: { flexDirection: 'row', alignItems: 'center' },
  lock: { justifyContent: 'center' },
});
