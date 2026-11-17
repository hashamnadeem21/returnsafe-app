import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useSnackbar } from '@/components/Snackbar';
import { ensureUserDoc } from '@/features/auth/authService';
import { kickUploads, startUploads, stopUploads } from '@/features/scan/uploadQueue';
import { useSession } from '@/stores/session';

import {
  onWriteError,
  subscribeCustomStores,
  subscribeProfile,
  subscribeReceipts,
} from './receiptsRepo';
import { useReceipts } from './receiptsStore';
import { flushStatus } from './statusActions';

const FIRST_PROFILE_RETRY_MS = 2_000;
const MAX_PROFILE_RETRY_MS = 60_000;

/**
 * Creates users/{uid} again when it is missing (the call at sign-in failed, for example offline).
 * Without it the rules can't check the free limit, so every new receipt would be refused. Tries
 * with growing waits until it works; the returned function stops it.
 */
function profileCreator(): { request: () => void; stop: () => void } {
  let stopped = false;
  let busy = false;
  let tries = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const request = () => {
    if (stopped || busy || timer) return;
    busy = true;
    ensureUserDoc()
      .catch(() => {
        if (stopped) return;
        const wait = Math.min(FIRST_PROFILE_RETRY_MS * 2 ** tries, MAX_PROFILE_RETRY_MS);
        tries += 1;
        timer = setTimeout(() => {
          timer = null;
          request();
        }, wait);
      })
      .finally(() => {
        busy = false;
      });
  };
  return {
    request,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

/**
 * Listens to the signed-in user's receipts, profile and custom stores, and uploads their queued
 * receipt photos (retrying whenever the app comes back to the foreground).
 */
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
    const creator = profileCreator();
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
        creator.request,
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
      creator.stop();
      unsubs.forEach((u) => u());
    };
  }, [uid, attempt]);

  useEffect(() => {
    if (!uid) return;
    void startUploads(uid);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') kickUploads();
    });
    return () => {
      sub.remove();
      stopUploads();
    };
  }, [uid]);

  return <>{children}</>;
}
