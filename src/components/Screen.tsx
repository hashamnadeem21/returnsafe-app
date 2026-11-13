import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** Pad the top safe area (false for modals that draw their own header area). */
  top?: boolean;
  /** Pad the bottom safe area (false on tab screens: the tab bar handles it). */
  bottom?: boolean;
  style?: ViewStyle;
  testID?: string;
};

/** Full-screen themed background with safe-area padding. */
export function Screen({ children, top = true, bottom = true, style, testID }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      style={[
        styles.fill,
        {
          backgroundColor: colors.bg,
          paddingTop: top ? insets.top : 0,
          paddingBottom: bottom ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
