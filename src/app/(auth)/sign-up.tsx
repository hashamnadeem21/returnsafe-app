import { PlaceholderScreen } from '@/components';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Create account"
      phase={2}
      icon="mail"
      kind="push"
      testID="screen-sign-up"
    />
  );
}
