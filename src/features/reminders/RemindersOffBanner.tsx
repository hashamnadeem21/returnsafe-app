import { Pressable, StyleSheet } from 'react-native';

import { AppText, Icon } from '@/components';
import { useReceipts } from '@/features/receipts/receiptsStore';
import { useSession } from '@/stores/session';
import { fonts, useTheme } from '@/theme';

import { turnOnPush, usePushPermission } from './permission';
import { saveReminderSettings } from './reminderSettings';

/**
 * Home banner shown whenever reminders cannot reach the user: notifications are not allowed on
 * the phone, or return reminders are switched off in S17. "Turn on" fixes whichever it is.
 */
export function RemindersOffBanner() {
  const { colors, radii, sizes } = useTheme();
  const uid = useSession((s) => s.user?.uid ?? null);
  const status = usePushPermission((s) => s.status);
  const setStatus = usePushPermission((s) => s.set);
  const switchedOff = useReceipts((s) => s.profile?.remindersEnabled === false);

  // Unknown until the permission has been read once: show nothing rather than flash the banner.
  if (!uid || status === null || (status === 'granted' && !switchedOff)) return null;

  const turnOn = async () => {
    if (switchedOff) saveReminderSettings(uid, { remindersEnabled: true });
    if (status !== 'granted') setStatus(await turnOnPush());
  };

  return (
    <Pressable
      testID="home-reminders-off"
      onPress={() => void turnOn()}
      accessibilityRole="button"
      accessibilityLabel="Reminders are off. Turn them on so you don't miss a deadline. Turn on"
      style={[
        styles.banner,
        {
          backgroundColor: colors.warningSoft,
          borderRadius: radii.banner,
          minHeight: sizes.tapTarget,
        },
      ]}
    >
      <Icon name="bellOff" size={20} color={colors.bannerWarnText} />
      <AppText variant="caption" style={[styles.text, { color: colors.bannerWarnText }]}>
        <AppText variant="caption" style={[styles.bold, { color: colors.bannerWarnText }]}>
          Reminders are off.
        </AppText>{' '}
        Turn them on so you don&apos;t miss a deadline.{' '}
        <AppText
          variant="caption"
          style={[styles.bold, styles.link, { color: colors.bannerWarnText }]}
        >
          Turn on
        </AppText>
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: { flex: 1 },
  bold: { fontFamily: fonts.bold },
  link: { textDecorationLine: 'underline' },
});
