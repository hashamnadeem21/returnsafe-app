import { PlaceholderScreen } from '@/components';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Never miss a deadline"
      phase={5}
      icon="bell"
      kind="push"
      testID="screen-notification-primer"
    />
  );
}
