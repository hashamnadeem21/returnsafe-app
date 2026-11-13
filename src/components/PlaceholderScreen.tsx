import { router } from 'expo-router';

import type { IconName } from './Icon';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';

type Props = {
  title: string;
  /** Build phase that fills this screen in. */
  phase: number;
  icon?: IconName;
  /** 'tab' = large title, no back; 'push' = back arrow; 'modal' = close (x). */
  kind?: 'tab' | 'push' | 'modal';
  testID: string;
};

/** Temporary screen body until the phase that builds it lands. */
export function PlaceholderScreen({
  title,
  phase,
  icon = 'receipt',
  kind = 'push',
  testID,
}: Props) {
  const back = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  return (
    <Screen testID={testID} bottom={kind !== 'tab'}>
      {kind === 'tab' ? (
        <ScreenHeader title={title} testID={`${testID}-title`} />
      ) : (
        <ScreenHeader
          mode="nav"
          title={title}
          onBack={back}
          backIcon={kind === 'modal' ? 'x' : 'back'}
          testID={`${testID}-title`}
        />
      )}
      <EmptyState icon={icon} title={title} message={`This screen is built in Phase ${phase}.`} />
    </Screen>
  );
}
