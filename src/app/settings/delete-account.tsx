import { PlaceholderScreen } from '@/components';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Delete account"
      phase={2}
      icon="alert"
      kind="push"
      testID="screen-settings-delete"
    />
  );
}
