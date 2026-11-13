import { View } from 'react-native';

import { AppText, Button, Card, Skeleton } from '@/components';
import { useTheme } from '@/theme';

import { useReceipts } from '../receiptsStore';

export function ListSkeleton() {
  const { spacing } = useTheme();
  return (
    <Card testID="receipts-loading" accessibilityLabel="Loading receipts">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', gap: spacing.md, padding: 14, alignItems: 'center' }}
        >
          <Skeleton width={42} height={42} radius={12} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="80%" height={12} />
          </View>
          <Skeleton width={56} height={24} radius={999} />
        </View>
      ))}
    </Card>
  );
}

export function ListError() {
  const { spacing } = useTheme();
  return (
    <Card
      testID="receipts-error"
      style={{ padding: spacing.xl, gap: spacing.sm, alignItems: 'center' }}
    >
      <AppText variant="headline">{"Couldn't load receipts"}</AppText>
      <AppText variant="caption" align="center">
        Check your connection and try again.
      </AppText>
      <Button
        label="Retry"
        variant="secondary"
        onPress={() => useReceipts.getState().retry()}
        testID="receipts-retry"
        style={{ alignSelf: 'stretch', marginTop: spacing.sm }}
      />
    </Card>
  );
}
