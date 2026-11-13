import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Card, Icon, LetterAvatar, ListRow, Screen, ScreenHeader } from '@/components';
import { useSession } from '@/stores/session';
import { useTheme } from '@/theme';

/** Settings tab: profile card and the settings rows. Rows for later phases open their placeholders. */
export default function Settings() {
  const { spacing, colors } = useTheme();
  const user = useSession((s) => s.user);
  const guest = user?.isAnonymous ?? true;
  const title = guest ? 'Guest' : (user?.displayName ?? user?.email ?? 'Your account');
  const subtitle = guest
    ? 'Save your account to keep your receipts'
    : user?.displayName
      ? user.email
      : null;
  const chevron = <Icon name="right" size={20} color={colors.muted} />;

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
          <ListRow
            title="Reminders"
            subtitle="When to get notified"
            letter="R"
            right={chevron}
            divider
            onPress={() => router.push('/settings/reminders')}
            testID="settings-reminders"
          />
          <ListRow
            title="ReturnSafe Pro"
            subtitle="Unlimited receipts and warranties"
            letter="P"
            right={chevron}
            divider
            onPress={() => router.push('/paywall')}
            testID="settings-pro"
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
