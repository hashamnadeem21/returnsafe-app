import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { avatarColors, avatarFallback, fonts, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  title: string;
  subtitle?: string;
  /** Letter for the avatar; defaults to the first letter of the title. */
  letter?: string;
  right?: ReactNode;
  onPress?: () => void;
  /** Draws the divider above this row (every row after the first in a card). */
  divider?: boolean;
  testID?: string;
};

export function LetterAvatar({ letter, size }: { letter: string; size?: number }) {
  const { radii, sizes } = useTheme();
  const key = letter.toUpperCase().charAt(0);
  const [bg, fg] = avatarColors[key] ?? avatarFallback;
  const s = size ?? sizes.avatar;
  return (
    <View
      style={[
        styles.avatar,
        { width: s, height: s, borderRadius: radii.avatar, backgroundColor: bg },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppText variant="headline" style={{ color: fg, fontFamily: fonts.bold }}>
        {key}
      </AppText>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  letter,
  right,
  onPress,
  divider = false,
  testID,
}: Props) {
  const { colors, sizes } = useTheme();
  const content = (
    <>
      <LetterAvatar letter={letter ?? title} />
      <View style={styles.mid}>
        <AppText variant="body" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </>
  );
  const rowStyle = [
    styles.row,
    { minHeight: sizes.tapTarget + 18 },
    divider && { borderTopWidth: sizes.hairline, borderTopColor: colors.border },
  ];
  if (!onPress) {
    return (
      <View testID={testID} style={rowStyle}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.bg }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  mid: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold },
});
