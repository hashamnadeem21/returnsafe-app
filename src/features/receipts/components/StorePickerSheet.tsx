import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Icon, ListRow, Sheet } from '@/components';
import { fonts, maxFontSizeMultiplier, useTheme } from '@/theme';

import {
  POPULAR_STORE_IDS,
  normalizeStoreName,
  policySummary,
  searchStores,
  storeById,
  type StoreMatch,
} from '../stores';
import type { CustomStore } from '../types';

export type PickedStore =
  | { kind: 'builtin'; id: string; name: string; returnDays: number }
  | { kind: 'custom'; name: string; returnDays: number }
  /** A name the user typed that is not saved yet: the form asks for its return window. */
  | { kind: 'new'; name: string };

type Props = {
  visible: boolean;
  customStores: readonly CustomStore[];
  onPick: (store: PickedStore) => void;
  onClose: () => void;
};

const MAX_NAME = 80;

export function StorePickerSheet({ visible, customStores, onPick, onClose }: Props) {
  const { colors, radii, sizes, spacing, type } = useTheme();
  const [query, setQuery] = useState('');
  // Start each opening with an empty search.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setQuery('');
  }

  const matches = useMemo(() => searchStores(query, customStores), [query, customStores]);
  const popular = useMemo(
    () =>
      POPULAR_STORE_IDS.map(storeById)
        .filter((s) => s !== undefined)
        .map((store): StoreMatch => ({ kind: 'builtin', store })),
    [],
  );
  const typed = query.trim().slice(0, MAX_NAME);
  const exact = matches.some((m) => normalizeStoreName(m.store.name) === normalizeStoreName(typed));
  const list = typed ? matches.slice(0, 20) : popular;

  const pick = (m: StoreMatch) =>
    onPick(
      m.kind === 'builtin'
        ? { kind: 'builtin', id: m.store.id, name: m.store.name, returnDays: m.store.returnDays }
        : { kind: 'custom', name: m.store.name, returnDays: m.store.returnDays },
    );

  return (
    <Sheet visible={visible} onClose={onClose} testID="store-picker">
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          Choose store
        </AppText>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={8}
          style={[styles.cancel, { minHeight: sizes.tapTarget }]}
          testID="store-picker-cancel"
        >
          <AppText variant="body" tone="primary" style={{ fontFamily: fonts.semibold }}>
            Cancel
          </AppText>
        </Pressable>
      </View>
      <View
        style={[
          styles.search,
          {
            height: sizes.input,
            borderRadius: radii.input,
            borderWidth: sizes.inputBorder,
            borderColor: colors.primary,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Icon name="search" size={20} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search stores"
          placeholderTextColor={colors.muted}
          autoFocus
          autoCorrect={false}
          returnKeyType="done"
          maxLength={MAX_NAME}
          accessibilityLabel="Search stores"
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          selectionColor={colors.primary}
          style={[styles.input, type.body, { color: colors.ink }]}
          testID="store-search"
        />
      </View>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {list.length > 0 ? (
          <AppText variant="label" tone="muted" style={{ marginTop: spacing.md }}>
            {typed ? 'MATCHES' : 'POPULAR'}
          </AppText>
        ) : null}
        {list.map((m, i) => (
          <ListRow
            key={`${m.kind}-${m.store.id}`}
            title={m.store.name}
            subtitle={
              m.kind === 'builtin'
                ? policySummary(m.store.returnDays, m.store.notes)
                : `Your store · ${m.store.returnDays} days`
            }
            divider={i > 0}
            onPress={() => pick(m)}
            testID={`store-option-${m.kind === 'builtin' ? m.store.id : `custom-${m.store.id}`}`}
          />
        ))}
        {typed && !exact ? (
          <Pressable
            onPress={() => onPick({ kind: 'new', name: typed })}
            accessibilityRole="button"
            accessibilityLabel={`Add ${typed} as a new store`}
            style={[styles.add, { minHeight: sizes.tapTarget, gap: spacing.sm }]}
            testID="store-add-new"
          >
            <Icon name="plus" size={22} color={colors.primary} />
            <AppText variant="body" tone="primary" style={{ fontFamily: fonts.semibold, flex: 1 }}>
              {`Add "${typed}" as a new store`}
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  input: { flex: 1, height: '100%', paddingVertical: 0 },
  list: { maxHeight: 360 },
  add: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
});
