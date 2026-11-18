import { useEffect, type ReactNode } from 'react';

import { useSession } from '@/stores/session';

import { startPurchases, stopPurchases } from './purchases';

/**
 * Signs RevenueCat in as the Firebase user, so Pro bought on any phone (or before a reinstall)
 * comes back on sign-in without tapping Restore, and out again on sign-out.
 */
export function PurchasesProvider({ children }: { children: ReactNode }) {
  const uid = useSession((s) => s.user?.uid ?? null);
  const ready = useSession((s) => s.ready);

  useEffect(() => {
    if (!ready) return;
    void (uid ? startPurchases(uid) : stopPurchases()).catch(() => undefined);
  }, [uid, ready]);

  return <>{children}</>;
}
