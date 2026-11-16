import { useEffect, type ReactNode } from 'react';

import { useSnackbar } from '@/components/Snackbar';
import { useSession } from '@/stores/session';

import {
  onWriteError,
  subscribeCustomStores,
  subscribeProfile,
  subscribeReceipts,
} from './receiptsRepo';
import { useReceipts } from './receiptsStore';
import { flushStatus } from './statusActions';

/** Listens to the signed-in user's receipts, profile and custom stores. */
export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const uid = useSession((s) => s.user?.uid ?? null);
  const attempt = useReceipts((s) => s.attempt);

  useEffect(() => {
    onWriteError(() =>
      useSnackbar.getState().show({ message: "Couldn't save a change. Check it and try again." }),
    );
  }, []);

  useEffect(() => {
    useReceipts.getState().reset(uid);
    if (!uid) return;
    const st = () => useReceipts.getState();
    const unsubs = [
      subscribeReceipts(
        uid,
        (r) => st().setReceipts(r),
        () => st().setError(true),
      ),
      subscribeProfile(
        uid,
        (p) => st().setProfile(p),
        () => undefined,
      ),
      subscribeCustomStores(
        uid,
        (c) => st().setCustomStores(c),
        () => undefined,
      ),
    ];
    return () => {
      // Save any change still inside its Undo window before the user's data goes away.
      flushStatus();
      unsubs.forEach((u) => u());
    };
  }, [uid, attempt]);

  return <>{children}</>;
}
