import { Pressable, StyleSheet } from 'react-native';

import { fonts, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  selected?: boolean;
  count?: number;
  onPress: () => void;
  testID?: string;
};

export function Chip({ label, selected = false, count, onPress, testID }: Props) {
  const { colors, radii, sizes } = useTheme();
  const fg = selected ? colors.onPrimary : colors.ink;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected }}
      hitSlop={{ top: 7, bottom: 7 }}
      style={[
        styles.chip,
        {
          height: sizes.chip,
          borderRadius: radii.chip,
          borderWidth: sizes.hairline,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText variant="caption" style={[styles.text, { color: fg }]}>
        {label}
      </AppText>
      {count === undefined ? null : (
        <AppText variant="caption" style={[styles.text, styles.count, { color: fg }]}>
          {count}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  text: { fontFamily: fonts.medium },
  count: { opacity: 0.7 },
});
