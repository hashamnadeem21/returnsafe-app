import { StyleSheet, View } from 'react-native';

import { fonts, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

/** Small "PRO" lock badge shown next to Pro-only features. */
export function ProLock({ testID }: { testID?: string }) {
  const { colors, scheme } = useTheme();
  const fg = scheme === 'dark' ? colors.primary : colors.primaryPressed;
  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel="Pro feature"
      style={[styles.lock, { backgroundColor: colors.primarySoft }]}
    >
      <Icon name="lock" size={12} color={fg} strokeWidth={2.4} />
      <AppText variant="label" style={[styles.text, { color: fg }]}>
        PRO
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 },
});
