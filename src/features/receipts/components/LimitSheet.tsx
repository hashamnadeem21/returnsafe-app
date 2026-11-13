import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Icon, Sheet } from '@/components';
import { useTheme } from '@/theme';

type Props = { visible: boolean; used: number; limit: number; onClose: () => void };

/** Shown instead of the form when a free user already has the maximum active receipts. */
export function LimitSheet({ visible, used, limit, onClose }: Props) {
  const { colors, radii, spacing } = useTheme();
  const fraction = Math.min(used / Math.max(limit, 1), 1);
  return (
    <Sheet visible={visible} onClose={onClose} testID="limit-sheet">
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <View
          style={[styles.badge, { backgroundColor: colors.primarySoft, borderRadius: radii.card }]}
        >
          <Icon name="receipt" size={34} color={colors.primary} />
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          {`You've used all ${limit} free receipts`}
        </AppText>
        <AppText variant="body" tone="ink2" align="center">
          Mark one as returned or kept to free a spot, or go Pro for unlimited receipts.
        </AppText>
        <View
          style={[styles.track, { backgroundColor: colors.border, borderRadius: radii.chip }]}
          accessibilityRole="progressbar"
          accessibilityLabel={`${used} of ${limit} active`}
          accessibilityValue={{ min: 0, max: limit, now: used }}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${fraction * 100}%`,
                backgroundColor: colors.primary,
                borderRadius: radii.chip,
              },
            ]}
          />
        </View>
        <AppText variant="caption">{`${used} of ${limit} active`}</AppText>
      </View>
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button
          label="See Pro plans"
          onPress={() => {
            onClose();
            router.push('/paywall');
          }}
          testID="limit-see-pro"
        />
        <Button label="Not now" variant="text" onPress={onClose} testID="limit-not-now" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  track: { width: '100%', height: 8, overflow: 'hidden' },
  fill: { height: '100%' },
});
