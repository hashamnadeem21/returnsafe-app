import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { fonts, useTheme, type Palette } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: ViewStyle;
};

function variantColors(variant: ButtonVariant, c: Palette, scheme: 'light' | 'dark') {
  switch (variant) {
    case 'primary':
      return { bg: c.primary, pressed: c.primaryPressed, fg: c.onPrimary, border: undefined };
    case 'secondary':
      return { bg: c.surface, pressed: c.bg, fg: c.ink, border: c.border };
    case 'soft':
      return {
        bg: c.primarySoft,
        pressed: c.primaryLine,
        fg: scheme === 'dark' ? c.primary : c.primaryPressed,
        border: undefined,
      };
    case 'danger':
      return { bg: c.danger, pressed: c.danger, fg: c.onDanger, border: undefined };
    case 'text':
      return { bg: undefined, pressed: c.primarySoft, fg: c.primary, border: undefined };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: Props) {
  const { colors, radii, sizes, scheme } = useTheme();
  const inactive = disabled || loading;
  const v = variantColors(variant, colors, scheme);
  const fg = disabled ? colors.muted : v.fg;

  const handlePress = () => {
    if (inactive) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: variant === 'text' ? sizes.textButton : sizes.button,
          borderRadius: radii.button,
          backgroundColor:
            disabled && variant !== 'text' ? colors.border : pressed ? v.pressed : v.bg,
          borderColor: v.border,
          borderWidth: v.border ? sizes.inputBorder : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} testID={testID ? `${testID}-spinner` : undefined} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <AppText variant="body" style={[styles.label, { color: fg }]}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignSelf: 'stretch',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: fonts.semibold },
});
