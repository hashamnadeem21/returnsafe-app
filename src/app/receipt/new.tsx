import { PlaceholderScreen } from '@/components';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="New receipt"
      phase={3}
      icon="plus"
      kind="push"
      testID="screen-receipt-new"
    />
  );
}
