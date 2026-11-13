import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Screen } from '@/components';
import { formatUsd } from '@/lib/money';
import { ListError, ListSkeleton } from '@/features/receipts/components/ListStates';
import { ReceiptRow } from '@/features/receipts/components/ReceiptRow';
import { daysLeftFor, displayStatus, isDueSoon, totals } from '@/features/receipts/derive';
import { useReceipts, useVisibleReceipts } from '@/features/receipts/receiptsStore';
import { useToday } from '@/features/receipts/useToday';
import { useSession } from '@/stores/session';
import { fonts, useTheme } from '@/theme';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Home (S08): money protected and saved, then what is due soon and later. */
export default function Home() {
  const { colors, radii, spacing } = useTheme();
  const today = useToday();
  const loaded = useReceipts((s) => s.loaded);
  const error = useReceipts((s) => s.error);
  const receipts = useVisibleReceipts();
  const name = useSession((s) => s.user?.displayName?.split(' ')[0] ?? null);

  const t = useMemo(() => totals(receipts, today), [receipts, today]);
  const active = useMemo(
    () =>
      receipts
        .filter((r) => displayStatus(r, today) === 'active')
        .sort((a, b) => daysLeftFor(a, today) - daysLeftFor(b, today)),
    [receipts, today],
  );
  const dueSoon = active.filter((r) => isDueSoon(r, today));
  const later = active.filter((r) => !isDueSoon(r, today));
  const empty = loaded && !error && receipts.length === 0;
  const hello = name
    ? `${greeting(new Date().getHours())}, ${name}`
    : greeting(new Date().getHours());

  return (
    <Screen testID="screen-home" bottom={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg, flexGrow: 1 }}>
        <View>
          <AppText variant="caption">{empty && name ? `Welcome, ${name}` : hello}</AppText>
          <AppText variant="display" accessibilityRole="header" testID="screen-home-title">
            Your returns
          </AppText>
        </View>

        {/* Reminders-off banner: shown from Phase 5, when reminder permission is wired up. */}

        {!loaded ? (
          <ListSkeleton />
        ) : error ? (
          <ListError />
        ) : empty ? (
          <View style={[styles.empty, { gap: spacing.md }]} testID="home-empty">
            <View
              style={[
                styles.emptyBadge,
                { backgroundColor: colors.primarySoft, borderRadius: radii.sheet },
              ]}
            >
              <Icon name="receipt" size={54} color={colors.primary} />
            </View>
            <AppText variant="title" align="center">
              No receipts yet
            </AppText>
            <AppText variant="body" tone="ink2" align="center">
              Scan your first receipt. It takes about 5 seconds.
            </AppText>
            <Button
              label="Scan a receipt"
              icon="scan"
              onPress={() => router.push('/scanner')}
              style={styles.stretch}
              testID="home-scan"
            />
            <Button
              label="Enter manually"
              variant="text"
              onPress={() => router.push('/receipt/new')}
              style={styles.stretch}
              testID="home-enter-manually"
            />
          </View>
        ) : (
          <>
            <View style={[styles.row, { gap: spacing.md }]}>
              <View
                style={[
                  styles.stat,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: radii.card,
                    padding: spacing.lg,
                  },
                ]}
                accessible
                accessibilityLabel={`Money protected, ${formatUsd(t.protectedCents)}, ${t.activeCount} active`}
                testID="home-protected"
              >
                <AppText variant="caption" style={{ color: colors.onPrimary, opacity: 0.85 }}>
                  Money protected
                </AppText>
                <AppText
                  variant="title"
                  style={{ color: colors.onPrimary, fontFamily: fonts.bold }}
                >
                  {formatUsd(t.protectedCents)}
                </AppText>
                <AppText variant="caption" style={{ color: colors.onPrimary, opacity: 0.85 }}>
                  {`${t.activeCount} active ${t.activeCount === 1 ? 'receipt' : 'receipts'}`}
                </AppText>
              </View>
              <Card
                style={[styles.stat, { padding: spacing.lg }]}
                accessible
                accessibilityLabel={`Money saved, ${formatUsd(t.savedCents)}, ${t.returnedCount} returned`}
                testID="home-saved"
              >
                <AppText variant="caption">Money saved</AppText>
                <AppText
                  variant="title"
                  style={{ fontFamily: fonts.bold }}
                  testID="home-saved-amount"
                >
                  {formatUsd(t.savedCents)}
                </AppText>
                <AppText variant="caption">{`${t.returnedCount} returned`}</AppText>
              </Card>
            </View>

            {dueSoon.length > 0 ? (
              <Section
                title="Due soon"
                action={{
                  label: 'See all',
                  onPress: () =>
                    router.push({ pathname: '/receipts', params: { filter: 'dueSoon' } }),
                }}
              >
                <Card style={styles.clip} testID="home-due-soon">
                  {dueSoon.map((r, i) => (
                    <ReceiptRow key={r.id} receipt={r} today={today} divider={i > 0} />
                  ))}
                </Card>
              </Section>
            ) : null}
            {later.length > 0 ? (
              <Section title="Later">
                <Card style={styles.clip} testID="home-later">
                  {later.map((r, i) => (
                    <ReceiptRow key={r.id} receipt={r} today={today} divider={i > 0} />
                  ))}
                </Card>
              </Section>
            ) : null}
            {active.length === 0 ? (
              <Card style={{ padding: spacing.xl, gap: spacing.sm }} testID="home-none-active">
                <AppText variant="headline">Nothing to return right now</AppText>
                <AppText variant="caption">
                  Receipts you add show here until their return window closes.
                </AppText>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  const { sizes, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.row, styles.between]}>
        <AppText variant="headline" accessibilityRole="header">
          {title}
        </AppText>
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={8}
            style={{ minHeight: sizes.tapTarget, justifyContent: 'center' }}
            testID="home-see-all"
          >
            <AppText variant="body" tone="primary" style={{ fontFamily: fonts.semibold }}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  stat: { flex: 1, gap: 4 },
  clip: { overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBadge: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  stretch: { alignSelf: 'stretch' },
});
