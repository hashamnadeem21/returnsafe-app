import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, LetterAvatar, ProLock, TextField } from '@/components';
import { computeDeadline, formatLongDate, isIsoDate } from '@/lib/dates';
import { fonts, useTheme } from '@/theme';

import { useReceipts } from '../receiptsStore';
import { receiptFormSchema, toReceiptInput, type ReceiptFormValues } from '../schema';
import { DEFAULT_CUSTOM_WINDOW, findStoreByName, storeById } from '../stores';
import type { ReceiptInput } from '../types';
import { useToday } from '../useToday';
import { DateField } from './DateField';
import { ReturnWindowSheet } from './ReturnWindowSheet';
import { StorePickerSheet, type PickedStore } from './StorePickerSheet';

type Props = {
  initial: ReceiptFormValues;
  submitLabel: string;
  onSubmit: (input: ReceiptInput) => void;
};

/** iOS cannot present a sheet while another one is still sliding away. */
const SHEET_SWAP_MS = Platform.OS === 'ios' ? 400 : 0;

/** New and edit receipt form: store, date, total, items, and the deadline they give. */
export function ReceiptForm({ initial, submitLabel, onSubmit }: Props) {
  const { colors, radii, sizes, spacing } = useTheme();
  const today = useToday();
  const customStores = useReceipts((s) => s.customStores);
  const resolver = useMemo(() => zodResolver(receiptFormSchema(today)), [today]);
  const { control, handleSubmit, setValue, formState } = useForm<ReceiptFormValues>({
    resolver,
    defaultValues: initial,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const [picker, setPicker] = useState(false);
  const [windowSheet, setWindowSheet] = useState(false);

  const [storeName, storeId, purchaseDate, returnDays] = useWatch({
    control,
    name: ['storeName', 'storeId', 'purchaseDate', 'returnDays'],
  });
  const builtin = storeById(storeId);
  const deadline =
    storeName && isIsoDate(purchaseDate) ? computeDeadline(purchaseDate, returnDays) : null;
  const policyLabel =
    builtin && returnDays === builtin.returnDays
      ? `${returnDays}-day ${builtin.name} policy`
      : `${returnDays}-day return window`;

  const setStore = (s: PickedStore) => {
    setPicker(false);
    const opts = { shouldValidate: formState.isSubmitted, shouldDirty: true };
    if (s.kind === 'new') {
      // A typed name that matches a built-in store (or alias) uses that store's policy.
      const known = findStoreByName(s.name);
      if (known) {
        setValue('storeId', known.id, opts);
        setValue('storeName', known.name, opts);
        setValue('returnDays', known.returnDays, opts);
        return;
      }
      setValue('storeId', null, opts);
      setValue('storeName', s.name, opts);
      setValue('returnDays', DEFAULT_CUSTOM_WINDOW, opts);
      setTimeout(() => setWindowSheet(true), SHEET_SWAP_MS);
      return;
    }
    setValue('storeId', s.kind === 'builtin' ? s.id : null, opts);
    setValue('storeName', s.name, opts);
    setValue('returnDays', s.returnDays, opts);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <AppText variant="caption" style={styles.label}>
          Store
        </AppText>
        <Pressable
          onPress={() => setPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={storeName ? `Store, ${storeName}` : 'Choose store'}
          accessibilityHint={formState.errors.storeName?.message}
          testID="receipt-store"
          style={[
            styles.field,
            {
              height: sizes.input,
              borderRadius: radii.input,
              borderWidth: sizes.inputBorder,
              borderColor: formState.errors.storeName ? colors.danger : colors.border,
              backgroundColor: colors.surface,
              gap: spacing.sm,
            },
          ]}
        >
          {storeName ? <LetterAvatar letter={storeName} size={28} /> : null}
          <AppText
            variant="body"
            numberOfLines={1}
            style={{ flex: 1, color: storeName ? colors.ink : colors.muted }}
          >
            {storeName || 'Choose store'}
          </AppText>
          <Icon name="down" size={20} color={colors.muted} />
        </Pressable>
        {formState.errors.storeName ? (
          <View style={styles.msgRow}>
            <Icon name="alert" size={14} color={colors.danger} />
            <AppText variant="caption" tone="danger">
              {formState.errors.storeName.message}
            </AppText>
          </View>
        ) : null}

        <View style={[styles.row, { gap: spacing.md, marginTop: spacing.md }]}>
          <View style={styles.half}>
            <Controller
              control={control}
              name="purchaseDate"
              render={({ field, fieldState }) => (
                <DateField
                  label="Purchase date"
                  value={field.value}
                  maxDate={today}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  testID="receipt-date"
                />
              )}
            />
          </View>
          <View style={styles.half}>
            <Controller
              control={control}
              name="amount"
              render={({ field, fieldState }) => (
                <TextField
                  label="Total"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="$0.00"
                  keyboardType="decimal-pad"
                  maxLength={12}
                  error={fieldState.error?.message}
                  testID="receipt-amount"
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="items"
          render={({ field, fieldState }) => (
            <TextField
              label="Items (optional)"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="Sneakers, bath towels"
              helper="Separate items with commas"
              maxLength={2000}
              error={fieldState.error?.message}
              testID="receipt-items"
            />
          )}
        />

        <View
          style={[
            styles.deadline,
            {
              backgroundColor: colors.primarySoft,
              borderRadius: radii.card,
              padding: spacing.lg,
              gap: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
          testID="receipt-deadline"
        >
          <Icon name="clock" size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            {deadline ? (
              <>
                <AppText variant="caption" tone="ink2">{`Return by · ${policyLabel}`}</AppText>
                <AppText variant="headline" testID="receipt-deadline-date">
                  {formatLongDate(deadline)}
                </AppText>
              </>
            ) : (
              <AppText variant="body" tone="ink2">
                Choose a store and date to see your return deadline
              </AppText>
            )}
          </View>
          {storeName ? (
            <Pressable
              onPress={() => setWindowSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Change return window"
              hitSlop={8}
              style={[styles.change, { minHeight: sizes.tapTarget, minWidth: sizes.tapTarget }]}
              testID="receipt-change-window"
            >
              <AppText variant="body" tone="primary" style={{ fontFamily: fonts.semibold }}>
                Change
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <Card style={{ marginBottom: spacing.xl }}>
          <Pressable
            onPress={() => router.push('/paywall')}
            accessibilityRole="button"
            accessibilityLabel="Add warranty, Pro feature"
            style={[styles.warranty, { minHeight: sizes.tapTarget + 8, gap: spacing.md }]}
            testID="receipt-add-warranty"
          >
            <Icon name="shield" size={22} color={colors.ink2} />
            <AppText variant="body" style={{ flex: 1, fontFamily: fonts.medium }}>
              Add warranty
            </AppText>
            {/* ProLock aligns itself to the top; centre it in this row. */}
            <View style={styles.lockWrap}>
              <ProLock />
            </View>
          </Pressable>
        </Card>

        <Button
          label={submitLabel}
          onPress={handleSubmit((v) => onSubmit(toReceiptInput(v)))}
          testID="receipt-save"
        />
      </ScrollView>

      <StorePickerSheet
        visible={picker}
        customStores={customStores}
        onPick={setStore}
        onClose={() => setPicker(false)}
      />
      <ReturnWindowSheet
        visible={windowSheet}
        storeName={storeName}
        initialDays={returnDays}
        onSave={(d) => {
          setValue('returnDays', d, { shouldDirty: true });
          setWindowSheet(false);
        }}
        onClose={() => setWindowSheet(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  msgRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
  deadline: { flexDirection: 'row', alignItems: 'center' },
  change: { alignItems: 'center', justifyContent: 'center' },
  warranty: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  lockWrap: { justifyContent: 'center' },
});
