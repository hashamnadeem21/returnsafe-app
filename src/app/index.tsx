import { Redirect } from 'expo-router';

import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { useSession } from '@/stores/session';

/** Entry: signed out → onboarding (first launch) or Welcome; signed in → primer (after sign-up) or Home. */
export default function Index() {
  const { seen } = useOnboarding();
  const user = useSession((s) => s.user);
  const showPrimer = useSession((s) => s.showPrimer);
  if (!user) return <Redirect href={seen ? '/welcome' : '/onboarding'} />;
  return <Redirect href={showPrimer ? '/notification-primer' : '/home'} />;
}
