import { PlaceholderScreen } from '@/components';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Receipts"
      phase={3}
      icon="receipt"
      kind="tab"
      testID="screen-receipts"
    />
  );
}
