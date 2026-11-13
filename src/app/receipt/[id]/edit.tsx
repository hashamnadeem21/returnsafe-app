import { PlaceholderScreen } from '@/components';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Edit receipt"
      phase={3}
      icon="receipt"
      kind="push"
      testID="screen-receipt-edit"
    />
  );
}
