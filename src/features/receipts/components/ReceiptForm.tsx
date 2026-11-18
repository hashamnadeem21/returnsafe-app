import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, LetterAvatar, Pill, ProLock, TextField } from '@/components';
import { ReceiptPhoto } from '@/features/scan/ReceiptPhoto';
import { addCalendarMonths, computeDeadline, formatLongDate, isIsoDate } from '@/lib/dates';
import { useIsPro } from '@/stores/pro';
import { fonts, useTheme } from '@/theme';

import { useReceipts } from '../receiptsStore';
import {
  parseWarrantyMonths,
  receiptFormSchema,
  toReceiptInput,
  type ReceiptFormValues,
} from '../schema';
import { DEFAULT_CUSTOM_WINDOW, findStoreByName, storeById } from '../stores';
import type { ReceiptInput } from '../types';
import { useToday } from '../useToday';
import { DateField } from './DateField';
import { ReturnWindowSheet } from './ReturnWindowSheet';
import { StorePickerSheet, type PickedStore } from './StorePickerSheet';

/** A scanned receipt under review: its photo and which fields the parser filled in. */
export type ScanReview = {
  photoUri: string;
  /** False: "We couldn't read this receipt", and the user fills in the form. */
  readable: boolean;
  detected: { store: boolean; date: boolean; total: boolean };
  onRetake: () => void;
};

type Props = {
  initial: ReceiptFormValues;
  submitLabel: string;
  /** May return a promise; the Save button shows it is busy until it settles. */
  onSubmit: (input: ReceiptInput) => void | Promise<void>;
  scan?: ScanReview;
};

function Detected({ testID }: { testID: string }) {
  return <Pill label="Detected" tone="teal" testID={testID} />;
}

/** iOS cannot present a sheet while another one is still sliding away. */
const SHEET_SWAP_MS = Platform.OS === 'ios' ? 400 : 0;

/** New and edit receipt form: store, date, total, items, and the deadline they give. */
export function ReceiptForm({ initial, submitLabel, onSubmit, scan }: Props) {
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
  const isPro = useIsPro();
  const [warrantyOpen, setWarrantyOpen] = useState(initial.warranty !== '');

  const [storeName, storeId, purchaseDate, returnDays, amount, warranty] = useWatch({
    control,
    name: ['storeName', 'storeId', 'purchaseDate', 'returnDays', 'amount', 'warranty'],
  });
  const warrantyMonths = parseWarrantyMonths(warranty);
  const warrantyEnd =
    warrantyMonths && isIsoDate(purchaseDate)
      ? addCalendarMonths(purchaseDate, warrantyMonths)
      : null;
  // A "Detected" badge stays only while the field still holds what the scan found.
  const detected = {
    store: !!scan?.detected.store && storeName === initial.storeName,
    date: !!scan?.detected.date && purchaseDate === initial.purchaseDate,
    total: !!scan?.detected.total && amount === initial.amount,
  };
  const builtin = storeById(storeId);
  const deadline =
    storeName && isIsoDate(purchaseDate) ? computeDeadline(purchaseDate, returnDays) : null;
  const usesPolicy = builtin !== undefined && returnDays === builtin.returnDays;
  const policyLabel = usesPolicy
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
        {scan ? (
          <Card
            style={[
              styles.scanCard,
              { padding: spacing.md, gap: spacing.md, marginBottom: spacing.lg },
            ]}
            testID="scan-summary"
          >
            <ReceiptPhoto localUri={scan.photoUri} width={48} height={62} testID="scan-photo" />
            <View style={styles.flex}>
              <View style={[styles.inline, { gap: spacing.xs }]}>
                <Icon
                  name={scan.readable ? 'check' : 'alert'}
                  size={18}
                  color={scan.readable ? colors.success : colors.warning}
                />
                <AppText variant="body" style={{ fontFamily: fonts.semibold }} testID="scan-status">
                  {scan.readable ? 'Receipt scanned' : "We couldn't read this receipt"}
                </AppText>
              </View>
              <AppText variant="caption">
                {scan.readable
                  ? 'Check the details below'
                  : 'Enter the details below. The photo is attached.'}
              </AppText>
            </View>
            <Pressable
              onPress={scan.onRetake}
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
              hitSlop={8}
              style={[styles.retake, { minHeight: sizes.tapTarget }]}
              testID="scan-retake"
            >
              <AppText variant="body" tone="primary" style={{ fontFamily: fonts.semibold }}>
                Retake
              </AppText>
            </Pressable>
          </Card>
        ) : null}

        <AppText variant="caption" style={styles.label}>
          Store
        </AppText>
        <Pressable
          onPress={() => setPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={
            storeName ? `Store, ${storeName}${detected.store ? ', detected' : ''}` : 'Choose store'
          }
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
          {detected.store ? (
            <Detected testID="detected-store" />
          ) : (
            <Icon name="down" size={20} color={colors.muted} />
          )}
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
                  badge={detected.date ? <Detected testID="detected-date" /> : undefined}
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
                  badge={detected.total ? <Detected testID="detected-total" /> : undefined}
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
                {usesPolicy && builtin.notes ? (
                  <AppText variant="caption" tone="ink2" testID="receipt-policy-note">
                    {builtin.notes}
                  </AppText>
                ) : null}
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

        {isPro && warrantyOpen ? (
          <Card style={{ marginBottom: spacing.xl, padding: spacing.lg }} testID="receipt-warranty">
            <Controller
              control={control}
              name="warranty"
              render={({ field, fieldState }) => (
                <TextField
                  label="Warranty (months)"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="12"
                  keyboardType="number-pad"
                  maxLength={3}
                  helper={
                    warrantyEnd
                      ? `Coverage ends ${formatLongDate(warrantyEnd)}`
                      : 'How long the warranty lasts'
                  }
                  error={fieldState.error?.message}
                  testID="receipt-warranty-months"
                />
              )}
            />
            <Button
              label="Remove warranty"
              variant="text"
              onPress={() => {
                setValue('warranty', '', { shouldDirty: true, shouldValidate: false });
                setWarrantyOpen(false);
              }}
              testID="receipt-warranty-remove"
            />
          </Card>
        ) : (
          <Card style={{ marginBottom: spacing.xl }}>
            <Pressable
              onPress={() => (isPro ? setWarrantyOpen(true) : router.push('/paywall'))}
              accessibilityRole="button"
              accessibilityLabel={isPro ? 'Add warranty' : 'Add warranty, Pro feature'}
              style={[styles.warranty, { minHeight: sizes.tapTarget + 8, gap: spacing.md }]}
              testID="receipt-add-warranty"
            >
              <Icon name="shield" size={22} color={colors.ink2} />
              <AppText variant="body" style={{ flex: 1, fontFamily: fonts.medium }}>
                {!isPro && initial.warranty
                  ? `Warranty · ${initial.warranty} months`
                  : 'Add warranty'}
              </AppText>
              {isPro ? (
                <Icon name="plus" size={20} color={colors.primary} />
              ) : (
                /* ProLock aligns itself to the top; centre it in this row. */
                <View style={styles.lockWrap}>
                  <ProLock />
                </View>
              )}
            </Pressable>
          </Card>
        )}

        <Button
          label={submitLabel}
          onPress={handleSubmit((v) => onSubmit(toReceiptInput(v, isPro)))}
          loading={formState.isSubmitting}
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
  inline: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  scanCard: { flexDirection: 'row', alignItems: 'center' },
  retake: { justifyContent: 'center' },
  half: { flex: 1 },
  deadline: { flexDirection: 'row', alignItems: 'center' },
  change: { alignItems: 'center', justifyContent: 'center' },
  warranty: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  lockWrap: { justifyContent: 'center' },
});
