import { StyleSheet, View } from 'react-native';

import { fonts, useTheme, type Palette } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type PillTone = 'red' | 'amber' | 'gray' | 'green' | 'teal';

/** Countdown tone: red 0–2 days, amber 3–7, gray 8+. */
export function toneForDaysLeft(days: number): PillTone {
  if (days <= 2) return 'red';
  if (days <= 7) return 'amber';
  return 'gray';
}

function toneColors(tone: PillTone, c: Palette, scheme: 'light' | 'dark') {
  switch (tone) {
    case 'red':
      return { bg: c.dangerSoft, fg: c.danger, border: undefined };
    case 'amber':
      return { bg: c.warningSoft, fg: c.warningText, border: undefined };
    case 'gray':
      return { bg: c.bg, fg: c.ink2, border: c.border };
    case 'green':
      return { bg: c.successSoft, fg: c.success, border: undefined };
    case 'teal':
      return {
        bg: c.primarySoft,
        fg: scheme === 'dark' ? c.primary : c.primaryPressed,
        border: undefined,
      };
  }
}

type Props = { label: string; tone: PillTone; icon?: IconName; testID?: string };

export function Pill({ label, tone, icon, testID }: Props) {
  const { colors, radii, sizes, scheme } = useTheme();
  const t = toneColors(tone, colors, scheme);
  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.pill,
        {
          height: sizes.pill,
          borderRadius: radii.chip,
          backgroundColor: t.bg,
          borderColor: t.border,
          borderWidth: t.border ? sizes.hairline : 0,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={13} color={t.fg} /> : null}
      <AppText variant="caption" style={[styles.text, { color: t.fg }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: { fontFamily: fonts.semibold },
});
