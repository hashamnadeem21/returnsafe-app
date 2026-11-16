import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, EmptyState, Screen, ScreenHeader } from '@/components';
import { useTheme } from '@/theme';

/** Scanner: the camera arrives in Phase 4. Until then, receipts are entered by hand. */
export default function Scanner() {
  const { spacing } = useTheme();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  return (
    <Screen testID="screen-scanner">
      <ScreenHeader
        mode="nav"
        title="Scan receipt"
        onBack={close}
        backIcon="x"
        testID="screen-scanner-title"
      />
      <EmptyState
        icon="scan"
        title="Scan receipt"
        message="This screen is built in Phase 4. You can add the receipt by hand for now."
      />
      <View style={{ padding: spacing.screen }}>
        <Button
          label="Enter manually"
          onPress={() => router.replace('/receipt/new')}
          testID="scanner-enter-manually"
        />
      </View>
    </Screen>
  );
}
