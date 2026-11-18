import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import {
  AppText,
  Card,
  Chip,
  Icon,
  ProLock,
  Screen,
  ScreenHeader,
  Sheet,
  useSnackbar,
} from '@/components';
import { useReceipts } from '@/features/receipts/receiptsStore';
import { turnOnPush, usePushPermission } from '@/features/reminders/permission';
import {
  formatHour,
  REMINDER_DAY_CHOICES,
  saveReminderSettings,
} from '@/features/reminders/reminderSettings';
import { useIsPro } from '@/stores/pro';
import { useSession } from '@/stores/session';
import { fonts, useTheme } from '@/theme';
import { openPaywall } from '@/features/subscription/openPaywall';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function Row({
  title,
  subtitle,
  right,
  left,
  onPress,
  divider,
  accessibilityLabel,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors, sizes, spacing } = useTheme();
  const style = [
    styles.row,
    { minHeight: sizes.tapTarget + 8, gap: spacing.md },
    divider && { borderTopWidth: sizes.hairline, borderTopColor: colors.border },
  ];
  const content = (
    <>
      {left}
      <View style={styles.mid}>
        <AppText variant="body" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
      </View>
      {right}
    </>
  );
  if (!onPress) {
    return (
      <View style={style} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={({ pressed }) => [style, pressed && { backgroundColor: colors.bg }]}
    >
      {content}
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { spacing } = useTheme();
  return (
    <AppText
      variant="label"
      style={{ marginTop: spacing.lg, marginBottom: spacing.sm, marginHorizontal: spacing.xs }}
    >
      {children}
    </AppText>
  );
}

/**
 * Reminder settings (S17): return reminders on or off, the time of day, which days before (7 and 3
 * are Pro), warranty reminders (Pro) and whether the phone allows notifications.
 */
export default function ReminderSettings() {
  const { colors, sizes, spacing } = useTheme();
  const uid = useSession((s) => s.user?.uid ?? null);
  const profile = useReceipts((s) => s.profile);
  const permission = usePushPermission((s) => s.status);
  const setPermission = usePushPermission((s) => s.set);
  const showSnackbar = useSnackbar((s) => s.show);
  const [hourSheet, setHourSheet] = useState(false);

  const enabled = profile?.remindersEnabled ?? true;
  const hour = profile?.reminderHour ?? 9;
  const isPro = useIsPro();
  const days = isPro ? (profile?.reminderDays ?? [7, 3, 1]) : [1];

  const save = (patch: Parameters<typeof saveReminderSettings>[1]) => {
    if (!uid) return;
    saveReminderSettings(uid, patch, () =>
      showSnackbar({ message: "Couldn't save your reminder settings. Try again." }),
    );
  };

  const toggleDay = (day: number) => {
    if (!isPro) {
      openPaywall('reminders');
      return;
    }
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    // At least one reminder stays on; switch reminders off above to stop them all.
    if (next.length === 0) return;
    save({ reminderDays: [...next].sort((a, b) => b - a) });
  };

  const allowed = permission === 'granted';

  return (
    <Screen testID="screen-settings-reminders">
      <ScreenHeader mode="nav" title="Reminders" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingTop: spacing.xs }}>
        <Card style={styles.card}>
          <Row
            title="Return reminders"
            subtitle="Before a return window closes"
            right={
              <Switch
                testID="reminders-toggle"
                value={enabled}
                onValueChange={(v) => save({ remindersEnabled: v })}
                accessibilityLabel="Return reminders"
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.border}
              />
            }
          />
          <Row
            title="Time of day"
            divider
            onPress={() => setHourSheet(true)}
            accessibilityLabel={`Time of day, ${formatHour(hour)}`}
            testID="reminders-time"
            right={
              <AppText variant="body" tone="primary" style={styles.title}>
                {formatHour(hour)}
              </AppText>
            }
          />
        </Card>

        <SectionLabel>REMIND ME</SectionLabel>
        <View style={[styles.chips, { gap: spacing.sm }]}>
          {REMINDER_DAY_CHOICES.map((day) => {
            const locked = !isPro && day !== 1;
            const on = days.includes(day);
            const label = day === 1 ? '1 day before' : `${day} days before`;
            return (
              <Chip
                key={day}
                label={label}
                icon={locked ? 'lock' : on ? 'check' : undefined}
                selected={on}
                onPress={() => toggleDay(day)}
                accessibilityLabel={locked ? `${label}, Pro feature` : label}
                testID={`reminder-day-${day}`}
              />
            );
          })}
        </View>
        {isPro ? null : (
          <AppText
            variant="caption"
            style={{ marginTop: spacing.sm, marginHorizontal: spacing.xs }}
          >
            Pro adds reminders 7 and 3 days before.
          </AppText>
        )}

        <SectionLabel>WARRANTIES</SectionLabel>
        <Card style={styles.card}>
          <Row
            title="Warranty reminders"
            subtitle="30 days before coverage ends"
            onPress={isPro ? undefined : () => openPaywall('reminders')}
            accessibilityLabel="Warranty reminders, 30 days before coverage ends, Pro feature"
            testID="reminders-warranty"
            right={isPro ? <Icon name="check" size={20} color={colors.success} /> : <ProLock />}
          />
        </Card>

        <SectionLabel>PHONE SETTINGS</SectionLabel>
        <Card style={styles.card}>
          <Row
            testID="reminders-permission"
            title={allowed ? 'Notifications allowed' : 'Notifications are off'}
            subtitle={allowed ? "Change in your phone's Settings" : 'Turn them on to get reminders'}
            onPress={() => void turnOnPush().then(setPermission)}
            left={
              allowed ? (
                <Icon name="check" size={20} color={colors.success} />
              ) : (
                <Icon name="bellOff" size={20} color={colors.bannerWarnText} />
              )
            }
            right={<Icon name="right" size={18} color={colors.muted} />}
          />
        </Card>
      </ScrollView>

      <Sheet
        visible={hourSheet}
        onClose={() => setHourSheet(false)}
        title="Time of day"
        testID="reminders-time-sheet"
      >
        <ScrollView style={styles.hours}>
          {HOURS.map((h) => (
            <Pressable
              key={h}
              testID={`reminder-hour-${h}`}
              accessibilityRole="button"
              accessibilityLabel={formatHour(h)}
              accessibilityState={{ selected: h === hour }}
              onPress={() => {
                setHourSheet(false);
                if (h !== hour) save({ reminderHour: h });
              }}
              style={[styles.hourRow, { minHeight: sizes.tapTarget }]}
            >
              <AppText
                variant="body"
                tone={h === hour ? 'primary' : 'ink'}
                style={h === hour ? styles.title : undefined}
              >
                {formatHour(h)}
              </AppText>
              {h === hour ? <Icon name="check" size={18} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  mid: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  hours: { maxHeight: 360 },
  hourRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
