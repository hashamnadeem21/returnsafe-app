import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Pill,
  Screen,
  ScreenHeader,
} from '@/components';
import { ListError, ListSkeleton } from '@/features/receipts/components/ListStates';
import { useReceipts, useVisibleReceipts } from '@/features/receipts/receiptsStore';
import { useToday } from '@/features/receipts/useToday';
import {
  activeWarranties,
  endingSoonMessage,
  timeLeftLabel,
  warrantySubtitle,
} from '@/features/warranties/warranties';
import { addCalendarMonths, formatMediumDate, monthsLabel } from '@/lib/dates';
import { useIsPro } from '@/stores/pro';
import { shadows, useTheme } from '@/theme';

const addWarranty = () => router.push('/receipt/new');

/** S14 for Free users: a faded sample list under an upgrade card that opens the paywall. */
function Locked() {
  const { colors, radii, spacing } = useTheme();
  const today = useToday();
  const samples = [
    { letter: 'T', name: 'Vacuum cleaner', store: 'Target', months: 4 },
    { letter: 'A', name: 'Headphones', store: 'Amazon', months: 11 },
    { letter: 'W', name: 'Air fryer', store: 'Walmart', months: 12 },
  ];
  return (
    <View style={{ padding: spacing.screen }}>
      <View
        style={styles.preview}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Card style={{ overflow: 'hidden' }}>
          {samples.map((s, i) => (
            <ListRow
              key={s.letter}
              title={s.name}
              subtitle={`${s.store} · ends ${formatMediumDate(addCalendarMonths(today, s.months))}`}
              letter={s.letter}
              divider={i > 0}
              right={<Pill label={monthsLabel(s.months)} tone={i === 0 ? 'amber' : 'gray'} />}
            />
          ))}
        </Card>
      </View>
      <Pressable
        onPress={() => router.push('/paywall')}
        accessibilityRole="button"
        accessibilityLabel="Track warranties with Pro. See Pro plans"
        testID="warranties-locked"
        style={[
          styles.lockedCard,
          shadows.card(colors.shadow),
          {
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            padding: spacing.xl + 2,
            marginTop: -120,
          },
        ]}
      >
        <View style={[styles.lockCircle, { backgroundColor: colors.primarySoft }]}>
          <Icon name="lock" size={28} color={colors.primary} />
        </View>
        <AppText variant="title" align="center" style={{ marginBottom: spacing.xs + 2 }}>
          Track warranties with Pro
        </AppText>
        <AppText variant="body" tone="ink2" align="center" style={{ marginBottom: spacing.lg }}>
          Save warranty end dates and get reminded before coverage runs out.
        </AppText>
        <Button
          label="See Pro plans"
          onPress={() => router.push('/paywall')}
          testID="warranties-see-pro"
          style={styles.fullWidth}
        />
      </Pressable>
    </View>
  );
}

/** Warranties (S14): Pro list sorted by end date with a 4-month warning; locked for Free. */
export default function Warranties() {
  const { spacing } = useTheme();
  const isPro = useIsPro();
  const today = useToday();
  const loaded = useReceipts((s) => s.loaded);
  const error = useReceipts((s) => s.error);
  const receipts = useVisibleReceipts();
  const list = useMemo(() => activeWarranties(receipts, today), [receipts, today]);
  const warning = endingSoonMessage(list, today);

  return (
    <Screen testID="screen-warranties" bottom={false}>
      <ScreenHeader
        title="Warranties"
        testID="screen-warranties-title"
        right={isPro ? <Pill label="Pro" tone="teal" icon="spark" testID="warranties-pro" /> : null}
      />
      <AppText
        variant="body"
        tone="ink2"
        style={{ paddingHorizontal: spacing.screen, marginTop: spacing.xs }}
        testID="warranties-caption"
      >
        {isPro && list.length > 0
          ? `${list.length} ${list.length === 1 ? 'product' : 'products'} covered`
          : 'Know when coverage ends'}
      </AppText>
      {!isPro ? (
        <ScrollView>
          <Locked />
        </ScrollView>
      ) : !loaded ? (
        <ListSkeleton />
      ) : error ? (
        <ListError />
      ) : list.length === 0 ? (
        <EmptyState
          icon="shield"
          title="No warranties yet"
          message="Add a warranty to a receipt to see when its coverage ends."
          actionLabel="Add warranty"
          onAction={addWarranty}
          testID="warranties-empty"
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg }}>
          {warning ? <Banner kind="warn" message={warning} testID="warranties-warning" /> : null}
          <Card style={{ overflow: 'hidden' }} testID="warranties-list">
            {list.map((w, i) => {
              const left = timeLeftLabel(w, today);
              return (
                <ListRow
                  key={w.receipt.id}
                  title={w.product}
                  subtitle={warrantySubtitle(w)}
                  letter={w.receipt.storeName}
                  divider={i > 0}
                  accessibilityLabel={`${w.product}, ${warrantySubtitle(w)}, ${left} left`}
                  right={<Pill label={left} tone={w.endingSoon ? 'amber' : 'gray'} />}
                  onPress={() => router.push(`/receipt/${w.receipt.id}`)}
                  testID={`warranty-${w.receipt.id}`}
                />
              );
            })}
          </Card>
          <Button
            label="Add warranty"
            variant="soft"
            icon="plus"
            onPress={addWarranty}
            testID="warranties-add"
          />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { opacity: 0.35 },
  lockedCard: { alignItems: 'center' },
  lockCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  fullWidth: { alignSelf: 'stretch' },
});
