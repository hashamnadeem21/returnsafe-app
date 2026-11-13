import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
};

/** Bottom sheet: scrim + rounded surface with a grab handle. Tapping the scrim or Back closes it. */
export function Sheet({ visible, onClose, title, children, testID }: Props) {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.fill} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          testID={testID}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              paddingHorizontal: spacing.screen,
              paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm,
            },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: colors.border }]} />
          {title ? (
            <AppText variant="headline" style={{ marginBottom: spacing.md }}>
              {title}
            </AppText>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingTop: 10 },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
});
