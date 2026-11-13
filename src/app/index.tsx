import { Redirect } from 'expo-router';

import { useOnboarding } from '@/features/onboarding/OnboardingProvider';

/** Entry: first launch → onboarding; afterwards → welcome (Phase 2 adds the signed-in check). */
export default function Index() {
  const { seen } = useOnboarding();
  return <Redirect href={seen ? '/welcome' : '/onboarding'} />;
}
