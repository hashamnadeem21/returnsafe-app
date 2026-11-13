import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { maxFontSizeMultiplier, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = Omit<TextInputProps, 'style'> & {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  label: string;
  helper?: string;
  error?: string;
  /** Password field: hides text and shows a show/hide toggle. */
  secure?: boolean;
  testID?: string;
};

export function TextField({
  label,
  helper,
  error,
  secure = false,
  testID,
  onFocus,
  onBlur,
  ref,
  ...rest
}: Props) {
  const { colors, radii, sizes, type, spacing } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          {
            height: sizes.input,
            borderRadius: radii.input,
            borderWidth: sizes.inputBorder,
            borderColor,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          allowFontScaling
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          secureTextEntry={secure && hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, type.body, { color: colors.ink }]}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={8}
            style={[styles.toggle, { width: sizes.tapTarget, height: sizes.tapTarget }]}
            testID={testID ? `${testID}-toggle` : undefined}
          >
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={20} color={colors.ink2} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.msgRow} accessibilityLiveRegion="polite">
          <Icon name="alert" size={14} color={colors.danger} />
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        </View>
      ) : helper ? (
        <AppText variant="caption" style={styles.msg}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  box: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  input: { flex: 1, height: '100%', paddingVertical: 0 },
  toggle: { alignItems: 'center', justifyContent: 'center' },
  msg: { marginTop: 6 },
  msgRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
