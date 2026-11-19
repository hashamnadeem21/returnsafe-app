import { View } from 'react-native';

import { useOnline } from '@/lib/network';
import { useTheme } from '@/theme';

import { Banner } from './Banner';

/**
 * "You're offline…" while the phone has no connection; nothing otherwise. `inset` adds the screen's
 * side padding, for use straight under a header.
 */
export function OfflineBanner({ inset = true }: { inset?: boolean }) {
  const online = useOnline();
  const { spacing } = useTheme();
  if (online) return null;
  const banner = (
    <Banner
      kind="offline"
      message="You're offline. Changes are saved and will sync when you're back online."
      testID="offline-banner"
    />
  );
  if (!inset) return banner;
  return (
    <View style={{ paddingHorizontal: spacing.screen, paddingTop: spacing.sm }}>{banner}</View>
  );
}
