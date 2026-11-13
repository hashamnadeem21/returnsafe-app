import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Chip, EmptyState, Icon, Screen, ScreenHeader } from '@/components';
import { ListError, ListSkeleton } from '@/features/receipts/components/ListStates';
import { ReceiptRow } from '@/features/receipts/components/ReceiptRow';
import {
  FILTERS,
  filterCounts,
  groupReceipts,
  matchesFilter,
  matchesSearch,
  type ReceiptFilter,
} from '@/features/receipts/derive';
import { useReceipts, useVisibleReceipts } from '@/features/receipts/receiptsStore';
import type { Receipt } from '@/features/receipts/types';
import { useToday } from '@/features/receipts/useToday';
import { maxFontSizeMultiplier, useTheme } from '@/theme';

type Item =
  | { type: 'header'; key: string; title: string }
  | { type: 'row'; key: string; receipt: Receipt; first: boolean; last: boolean };

const isFilter = (v: unknown): v is ReceiptFilter => FILTERS.some((f) => f.key === v);

/** Receipts (S13): search, filter chips with counts, and the grouped list. */
export default function Receipts() {
  const { colors, radii, sizes, spacing, type } = useTheme();
  const params = useLocalSearchParams<{ filter?: string }>();
  const today = useToday();
  const loaded = useReceipts((s) => s.loaded);
  const error = useReceipts((s) => s.error);
  const receipts = useVisibleReceipts();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ReceiptFilter>(() =>
    isFilter(params.filter) ? params.filter : 'all',
  );

  // "See all" on Home opens this tab with a filter.
  const [paramFilter, setParamFilter] = useState(params.filter);
  if (params.filter !== paramFilter) {
    setParamFilter(params.filter);
    if (isFilter(params.filter)) setFilter(params.filter);
  }

  const searched = useMemo(
    () => receipts.filter((r) => matchesSearch(r, query)),
    [receipts, query],
  );
  const counts = useMemo(() => filterCounts(searched, today), [searched, today]);
  const items = useMemo<Item[]>(() => {
    const shown = searched.filter((r) => matchesFilter(r, filter, today));
    return groupReceipts(shown, today).flatMap((g) => [
      { type: 'header' as const, key: `h-${g.key}`, title: g.title },
      ...g.receipts.map((r, i) => ({
        type: 'row' as const,
        key: r.id,
        receipt: r,
        first: i === 0,
        last: i === g.receipts.length - 1,
      })),
    ]);
  }, [searched, filter, today]);

  return (
    <Screen testID="screen-receipts" bottom={false}>
      <ScreenHeader title="Receipts" testID="screen-receipts-title" />
      <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.md }}>
        <View
          style={[
            styles.search,
            {
              height: sizes.input,
              borderRadius: radii.input,
              borderWidth: sizes.inputBorder,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search store or item"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Search store or item"
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            selectionColor={colors.primary}
            style={[styles.input, type.body, { color: colors.ink }]}
            testID="receipts-search"
          />
        </View>
      </View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingHorizontal: spacing.screen,
            paddingVertical: spacing.md,
          }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              count={counts[f.key]}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
              testID={`filter-${f.key}`}
            />
          ))}
        </ScrollView>
      </View>
      {!loaded ? (
        <View style={{ paddingHorizontal: spacing.screen }}>
          <ListSkeleton />
        </View>
      ) : error ? (
        <View style={{ paddingHorizontal: spacing.screen }}>
          <ListError />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon={query ? 'search' : 'receipt'}
          title={query ? 'No matches' : 'No receipts here'}
          message={query ? `Nothing matches "${query.trim()}".` : 'Receipts you add show up here.'}
          testID="receipts-empty"
        />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(i) => i.key}
          getItemType={(i) => i.type}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingHorizontal: spacing.screen,
            paddingBottom: sizes.tabBar + spacing.xxl,
          }}
          testID="receipts-list"
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <AppText
                variant="label"
                tone="muted"
                accessibilityRole="header"
                style={{ paddingTop: spacing.lg, paddingBottom: spacing.sm }}
              >
                {item.title}
              </AppText>
            ) : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderLeftWidth: sizes.hairline,
                  borderRightWidth: sizes.hairline,
                  borderTopWidth: item.first ? sizes.hairline : 0,
                  borderBottomWidth: item.last ? sizes.hairline : 0,
                  borderTopLeftRadius: item.first ? radii.card : 0,
                  borderTopRightRadius: item.first ? radii.card : 0,
                  borderBottomLeftRadius: item.last ? radii.card : 0,
                  borderBottomRightRadius: item.last ? radii.card : 0,
                  overflow: 'hidden',
                }}
              >
                <ReceiptRow receipt={item.receipt} today={today} divider={!item.first} />
              </View>
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', paddingVertical: 0 },
});
