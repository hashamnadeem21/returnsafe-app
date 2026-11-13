import { PlaceholderScreen } from '@/components';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Scan receipt"
      phase={4}
      icon="scan"
      kind="modal"
      testID="screen-scanner"
    />
  );
}
