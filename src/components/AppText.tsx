import { Text, type TextProps, type TextStyle } from 'react-native';

import { maxFontSizeMultiplier, useTheme, type TypeVariant } from '@/theme';

type Tone = 'ink' | 'ink2' | 'muted' | 'primary' | 'danger' | 'onPrimary';

type Props = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
};

/** All app text goes through here: Inter type scale, theme colour, capped font scaling. */
export function AppText({ variant = 'body', tone, align, style, ...rest }: Props) {
  const { colors, type } = useTheme();
  const defaultTone: Tone = variant === 'caption' || variant === 'label' ? 'ink2' : 'ink';
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[type[variant], { color: colors[tone ?? defaultTone], textAlign: align }, style]}
    />
  );
}
