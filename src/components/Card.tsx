import { View, type ViewProps } from 'react-native';

import { shadows, useTheme } from '@/theme';

/** Same card on both platforms: 1px border plus platform shadow (iOS) / elevation (Android). */
export function Card({ style, ...rest }: ViewProps) {
  const { colors, radii, sizes } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: sizes.hairline,
          borderRadius: radii.card,
        },
        shadows.card(colors.shadow),
        style,
      ]}
    />
  );
}
