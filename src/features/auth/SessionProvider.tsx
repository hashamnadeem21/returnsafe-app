import { onAuthStateChanged, onIdTokenChanged, signOut } from '@react-native-firebase/auth';
import { useEffect, type ReactNode } from 'react';

import { auth, configureFirebase } from '@/lib/firebase';
import { takeFreshInstall } from '@/lib/install';
import { useSession } from '@/stores/session';

/** Keeps the session store in step with Firebase Auth (persisted across launches by Firebase). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const setUser = useSession((s) => s.setUser);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    let alive = true;
    void (async () => {
      await configureFirebase();
      // A login left in the iOS Keychain by a deleted install must not sign the new install in.
      if (await takeFreshInstall()) await signOut(auth()).catch(() => undefined);
      if (!alive) return;
      unsubs = [
        onAuthStateChanged(auth(), (user) => setUser(user)),
        // Also refresh on token changes (email verified, profile/provider linked).
        onIdTokenChanged(auth(), (user) => setUser(user)),
      ];
    })();
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }, [setUser]);

  return <>{children}</>;
}
