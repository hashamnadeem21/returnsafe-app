import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Icon, Sheet } from '@/components';
import {
  formatMediumDate,
  isIsoDate,
  isoToPickerDate,
  pickerDateToIso,
  type IsoDate,
} from '@/lib/dates';
import { useTheme } from '@/theme';

type Props = {
  label: string;
  value: IsoDate;
  maxDate: IsoDate;
  onChange: (date: IsoDate) => void;
  error?: string;
  testID?: string;
};

/** Purchase date: an inline calendar in a sheet on iOS, the Material date dialog on Android. */
export function DateField({ label, value, maxDate, onChange, error, testID }: Props) {
  const { colors, radii, sizes, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());
  const current = isIsoDate(value) ? isoToPickerDate(value) : isoToPickerDate(maxDate);

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        maximumDate: isoToPickerDate(maxDate),
        onChange: (e, d) => {
          if (e.type === 'set' && d) onChange(pickerDateToIso(d));
        },
      });
      return;
    }
    setDraft(current);
    setOpen(true);
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${isIsoDate(value) ? formatMediumDate(value) : 'not set'}`}
        accessibilityHint={error}
        testID={testID}
        style={[
          styles.box,
          {
            height: sizes.input,
            borderRadius: radii.input,
            borderWidth: sizes.inputBorder,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            gap: spacing.sm,
          },
        ]}
      >
        <Icon name="cal" size={18} color={colors.muted} />
        <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
          {isIsoDate(value) ? formatMediumDate(value) : 'Choose date'}
        </AppText>
      </Pressable>
      {error ? (
        <View style={styles.msgRow} accessibilityLiveRegion="polite">
          <Icon name="alert" size={14} color={colors.danger} />
          <AppText variant="caption" tone="danger" style={{ flex: 1 }}>
            {error}
          </AppText>
        </View>
      ) : null}
      {Platform.OS === 'ios' ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label} testID="date-sheet">
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            maximumDate={isoToPickerDate(maxDate)}
            accentColor={colors.primary}
            onChange={(_, d) => d && setDraft(d)}
            testID="date-picker"
          />
          <Button
            label="Done"
            onPress={() => {
              onChange(pickerDateToIso(draft));
              setOpen(false);
            }}
            testID="date-done"
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  box: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  msgRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
