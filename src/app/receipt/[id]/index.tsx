import { formatInTimeZone } from 'date-fns-tz';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  CountdownRing,
  EmptyState,
  Icon,
  Screen,
  ScreenHeader,
  Sheet,
} from '@/components';
import { formatMediumDate, formatShortDate, reminderInstants } from '@/lib/dates';
import { formatUsd } from '@/lib/money';
import { StatusPill } from '@/features/receipts/components/ReceiptRow';
import { daysLeftFor, displayStatus } from '@/features/receipts/derive';
import { deleteReceipt } from '@/features/receipts/receiptsRepo';
import { useVisibleReceipts, useReceipts } from '@/features/receipts/receiptsStore';
import { changeStatusWithUndo, undoStatus } from '@/features/receipts/statusActions';
import { useTimezone, useToday } from '@/features/receipts/useToday';
import { useSession } from '@/stores/session';
import { fonts, useTheme } from '@/theme';

const back = () => (router.canGoBack() ? router.back() : router.replace('/home'));

/** Receipt detail (S12): countdown, items, and Returned / Keep it. */
export default function ReceiptDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, sizes, spacing } = useTheme();
  const uid = useSession((s) => s.user?.uid);
  const today = useToday();
  const tz = useTimezone();
  const receipt = useVisibleReceipts().find((r) => r.id === id);
  const profile = useReceipts((s) => s.profile);
  const [menu, setMenu] = useState(false);
  const [openedAt] = useState(() => Date.now());

  if (!receipt || !uid) {
    return (
      <Screen testID="screen-receipt-detail">
        <ScreenHeader mode="nav" title="Receipt" onBack={back} />
        <EmptyState icon="receipt" title="Receipt not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const status = displayStatus(receipt, today);
  const days = daysLeftFor(receipt, today);
  const nextReminder =
    status === 'active'
      ? reminderInstants(
          receipt.returnDeadline,
          profile?.reminderDays ?? [7, 3, 1],
          profile?.reminderHour ?? 9,
          tz,
        ).find((d) => d.getTime() > openedAt)
      : undefined;

  const confirmDelete = () => {
    setMenu(false);
    Alert.alert('Delete this receipt?', 'This removes it from ReturnSafe for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          undoStatus(receipt.id);
          deleteReceipt(uid, receipt.id);
          back();
        },
      },
    ]);
  };

  return (
    <Screen testID="screen-receipt-detail">
      <ScreenHeader
        mode="nav"
        title={receipt.storeName}
        onBack={back}
        testID="receipt-detail-title"
        right={
          <Pressable
            onPress={() => setMenu(true)}
            accessibilityRole="button"
            accessibilityLabel="More actions"
            style={[styles.center, { width: sizes.tapTarget, height: sizes.tapTarget }]}
            testID="receipt-more"
          >
            <Icon name="more" size={24} color={colors.ink} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg }}>
        <View style={[styles.center, { gap: spacing.md }]}>
          {status === 'active' ? (
            <CountdownRing
              daysLeft={days}
              totalDays={receipt.returnDays}
              size={168}
              testID="receipt-ring"
            />
          ) : null}
          {status !== 'active' || receipt.pending ? (
            <StatusPill receipt={receipt} today={today} />
          ) : null}
          <View style={styles.center}>
            <AppText variant="headline" align="center" testID="receipt-return-by">
              {status === 'expired'
                ? `Return window closed ${formatShortDate(receipt.returnDeadline)}`
                : `Return by ${formatShortDate(receipt.returnDeadline)}`}
            </AppText>
            <AppText variant="caption" align="center">
              {`Bought ${formatMediumDate(receipt.purchaseDate)} · ${receipt.returnDays}-day policy`}
            </AppText>
          </View>
        </View>

        <Card style={{ overflow: 'hidden' }}>
          {receipt.items.map((item, i) => (
            <View
              key={`${i}-${item}`}
              style={[
                styles.line,
                { minHeight: sizes.tapTarget, paddingHorizontal: spacing.lg },
                i > 0 && { borderTopWidth: sizes.hairline, borderTopColor: colors.border },
              ]}
            >
              <AppText variant="body" tone="ink2" style={{ flex: 1 }}>
                {item}
              </AppText>
            </View>
          ))}
          <View
            style={[
              styles.line,
              { minHeight: sizes.tapTarget, paddingHorizontal: spacing.lg },
              receipt.items.length > 0 && {
                borderTopWidth: sizes.hairline,
                borderTopColor: colors.border,
              },
            ]}
          >
            <AppText variant="body" style={{ flex: 1, fontFamily: fonts.semibold }}>
              Total
            </AppText>
            <AppText variant="body" style={{ fontFamily: fonts.bold }} testID="receipt-total">
              {formatUsd(receipt.amountCents)}
            </AppText>
          </View>
        </Card>

        <View style={[styles.row, { gap: spacing.md }]}>
          <Card style={[styles.tile, { padding: spacing.lg, gap: spacing.sm }]}>
            <Icon name="image" size={22} color={colors.ink2} />
            <AppText variant="body" style={{ fontFamily: fonts.semibold }}>
              Photo
            </AppText>
            <AppText variant="caption">
              {receipt.photoPaths.length > 0 ? `${receipt.photoPaths.length} receipt` : 'No photo'}
            </AppText>
          </Card>
          <Card style={[styles.tile, { padding: spacing.lg, gap: spacing.sm }]}>
            <Icon name="bell" size={22} color={colors.ink2} />
            <AppText variant="body" style={{ fontFamily: fonts.semibold }}>
              Reminder
            </AppText>
            <AppText variant="caption">
              {nextReminder ? formatInTimeZone(nextReminder, tz, 'MMM d, h:mm a') : 'None'}
            </AppText>
          </Card>
        </View>

        {status === 'active' ? (
          <View style={[styles.row, { gap: spacing.md }]}>
            <Button
              label="Keep it"
              variant="secondary"
              onPress={() => changeStatusWithUndo(uid, receipt.id, 'kept')}
              style={styles.flex}
              testID="receipt-keep"
            />
            <Button
              label="I returned it"
              icon="check"
              onPress={() => changeStatusWithUndo(uid, receipt.id, 'returned')}
              style={styles.flex}
              testID="receipt-returned"
            />
          </View>
        ) : null}
      </ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)} testID="receipt-menu">
        <MenuRow
          icon="edit"
          label="Edit receipt"
          onPress={() => {
            setMenu(false);
            router.push({ pathname: '/receipt/[id]/edit', params: { id: receipt.id } });
          }}
          testID="receipt-edit"
        />
        <MenuRow
          icon="trash"
          label="Delete receipt"
          danger
          onPress={confirmDelete}
          testID="receipt-delete"
        />
      </Sheet>
    </Screen>
  );
}

function MenuRow(p: {
  icon: 'edit' | 'trash';
  label: string;
  danger?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, sizes, spacing } = useTheme();
  return (
    <Pressable
      onPress={p.onPress}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      style={[styles.line, { minHeight: sizes.tapTarget + 8, gap: spacing.md }]}
      testID={p.testID}
    >
      <Icon name={p.icon} size={22} color={p.danger ? colors.danger : colors.ink} />
      <AppText
        variant="body"
        tone={p.danger ? 'danger' : 'ink'}
        style={{ fontFamily: fonts.medium }}
      >
        {p.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  tile: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center' },
});
