// Style/Type live on AppleButton at runtime; the separately exported enums are type-only.
import { AppleButton } from '@invertase/react-native-apple-authentication';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components';
import { fonts, useTheme } from '@/theme';

import { appleSignInAvailable } from '../providers';
import { GoogleLogo } from './GoogleLogo';

type Props = {
  onApple: () => void;
  onGoogle: () => void;
  busy?: 'apple' | 'google' | null;
  disabled?: boolean;
  /** "Continue" on Welcome, "Save with" on the Account screen. */
  verb?: 'continue' | 'save';
};

function GoogleButton({
  onPress,
  busy,
  disabled,
  label,
}: {
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
  label: string;
}) {
  const { colors, radii, sizes } = useTheme();
  const inactive = busy || disabled;
  return (
    <Pressable
      testID="auth-google"
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        styles.google,
        {
          minHeight: sizes.button,
          borderRadius: radii.button,
          backgroundColor: colors.googleBg,
          borderColor: colors.googleBorder,
          borderWidth: sizes.inputBorder,
          opacity: pressed || disabled ? 0.7 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.googleFg} />
      ) : (
        <View style={styles.row}>
          <GoogleLogo />
          <AppText variant="body" style={[styles.label, { color: colors.googleFg }]}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Apple (iOS only) and Google buttons in platform order:
 * Apple first on iOS (App Store guideline 4.8), Google first on Android where Apple is hidden.
 */
export function SocialButtons({
  onApple,
  onGoogle,
  busy = null,
  disabled = false,
  verb = 'continue',
}: Props) {
  const { radii, sizes, scheme } = useTheme();
  const showApple = Platform.OS === 'ios' && appleSignInAvailable;
  const google = (
    <GoogleButton
      key="google"
      onPress={onGoogle}
      busy={busy === 'google'}
      disabled={disabled || busy !== null}
      label={verb === 'save' ? 'Save with Google' : 'Continue with Google'}
    />
  );
  if (!showApple) return google;
  const apple = (
    <View key="apple" pointerEvents={disabled || busy !== null ? 'none' : 'auto'}>
      {busy === 'apple' ? (
        <View style={[styles.appleBusy, { height: sizes.button, borderRadius: radii.button }]}>
          <ActivityIndicator />
        </View>
      ) : (
        <AppleButton
          testID="auth-apple"
          buttonStyle={scheme === 'dark' ? AppleButton.Style.WHITE : AppleButton.Style.BLACK}
          buttonType={verb === 'save' ? AppleButton.Type.CONTINUE : AppleButton.Type.SIGN_IN}
          cornerRadius={radii.button}
          style={{ height: sizes.button, alignSelf: 'stretch' }}
          onPress={onApple}
        />
      )}
    </View>
  );
  return (
    <>
      {apple}
      {google}
    </>
  );
}

const styles = StyleSheet.create({
  google: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignSelf: 'stretch',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: fonts.semibold },
  appleBusy: { alignItems: 'center', justifyContent: 'center' },
});
