import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding';

type State = { ready: boolean; seen: boolean; complete: () => Promise<void> };

const OnboardingContext = createContext<State>({
  ready: false,
  seen: false,
  complete: async () => {},
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    let alive = true;
    void hasSeenOnboarding().then((value) => {
      if (!alive) return;
      setSeen(value);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const complete = useCallback(async () => {
    await markOnboardingSeen();
    setSeen(true);
  }, []);

  const value = useMemo(() => ({ ready, seen, complete }), [ready, seen, complete]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): State {
  return useContext(OnboardingContext);
}
