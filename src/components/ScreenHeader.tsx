import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  /** Large page title (tab roots) or centred nav title (pushed screens). */
  title: string;
  /** 'large' = Display title on tab roots; 'nav' = back/close bar with a centred title. */
  mode?: 'large' | 'nav';
  onBack?: () => void;
  backIcon?: 'back' | 'x';
  right?: ReactNode;
  testID?: string;
};

export function ScreenHeader({
  title,
  mode = 'large',
  onBack,
  backIcon = 'back',
  right,
  testID,
}: Props) {
  const { colors, sizes, spacing } = useTheme();
  if (mode === 'large') {
    return (
      <View style={[styles.large, { paddingHorizontal: spacing.screen, paddingTop: spacing.xs }]}>
        <AppText variant="display" accessibilityRole="header" testID={testID}>
          {title}
        </AppText>
        {right}
      </View>
    );
  }
  const btn = { width: sizes.tapTarget, height: sizes.tapTarget };
  return (
    <View style={[styles.nav, { paddingHorizontal: spacing.xs }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backIcon === 'x' ? 'Close' : 'Back'}
          style={[styles.iconBtn, btn]}
          testID="header-back"
        >
          <Icon name={backIcon} size={backIcon === 'x' ? 24 : 26} color={colors.ink} />
        </Pressable>
      ) : (
        <View style={btn} />
      )}
      <AppText
        variant="headline"
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.navTitle}
        testID={testID}
      >
        {title}
      </AppText>
      <View style={[styles.iconBtn, btn]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  nav: { flexDirection: 'row', alignItems: 'center', height: 52 },
  navTitle: { flex: 1, textAlign: 'center' },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
});
