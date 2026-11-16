import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Chip, Sheet, TextField } from '@/components';
import { useTheme } from '@/theme';

import { MAX_RETURN_DAYS } from '../schema';
import { CUSTOM_WINDOWS } from '../stores';

type Props = {
  visible: boolean;
  storeName: string;
  initialDays: number;
  onSave: (days: number) => void;
  onClose: () => void;
};

/** Pick how many days the store gives for returns: 14, 30, 60, 90 or any number up to 365. */
export function ReturnWindowSheet({ visible, storeName, initialDays, onSave, onClose }: Props) {
  const { spacing } = useTheme();
  const [text, setText] = useState(String(initialDays));
  // Each opening starts from the receipt's current window.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setText(String(initialDays));
  }

  const days = /^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : NaN;
  const valid = Number.isInteger(days) && days >= 1 && days <= MAX_RETURN_DAYS;

  return (
    <Sheet visible={visible} onClose={onClose} title="Return window" testID="window-sheet">
      <AppText variant="body" tone="ink2" style={{ marginBottom: spacing.md }}>
        {`How many days does ${storeName || 'this store'} give you to return items?`}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        {CUSTOM_WINDOWS.map((d) => (
          <Chip
            key={d}
            label={`${d} days`}
            selected={days === d}
            onPress={() => setText(String(d))}
            testID={`window-${d}`}
          />
        ))}
      </View>
      <TextField
        label="Days"
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        maxLength={3}
        error={text.trim() && !valid ? `Enter 1 to ${MAX_RETURN_DAYS} days` : undefined}
        testID="window-days"
      />
      <Button
        label="Use this window"
        disabled={!valid}
        onPress={() => onSave(days)}
        testID="window-save"
      />
    </Sheet>
  );
}
