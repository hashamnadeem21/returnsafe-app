import { PlaceholderScreen } from '@/components';

export default function Screen() {
  return (
    <PlaceholderScreen
      title="Reminders"
      phase={5}
      icon="bell"
      kind="push"
      testID="screen-settings-reminders"
    />
  );
}
