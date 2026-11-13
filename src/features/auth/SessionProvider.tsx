import { onAuthStateChanged, onIdTokenChanged, signOut } from '@react-native-firebase/auth';
import { useEffect, type ReactNode } from 'react';

import { auth, configureFirebase } from '@/lib/firebase';
import { finishPendingSignIn } from '@/features/auth/authService';
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
      let restored = false;
      unsubs = [
        onAuthStateChanged(auth(), (user) => {
          setUser(user);
          // A session restored at launch never went through a sign-in call, so retry the user doc
          // and any guest merge that failed then (both are idempotent).
          if (!restored && user) void finishPendingSignIn().catch(() => undefined);
          restored = true;
        }),
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
