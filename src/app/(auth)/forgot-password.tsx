import { PlaceholderScreen } from '@/components';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Reset password"
      phase={2}
      icon="mail"
      kind="push"
      testID="screen-forgot-password"
    />
  );
}
