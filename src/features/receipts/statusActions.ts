import * as Haptics from 'expo-haptics';

import { useSnackbar } from '@/components/Snackbar';

import { setReceiptStatus } from './receiptsRepo';
import { useReceipts } from './receiptsStore';
import type { ReceiptStatus } from './types';

export const UNDO_MS = 5000;

const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => void }>();

/**
 * Shows the new status at once and offers Undo for 5 seconds; the change is saved when the window
 * closes. Undo therefore never writes, so money saved and the free-limit counter stay unchanged.
 */
export function changeStatusWithUndo(
  uid: string,
  id: string,
  status: Extract<ReceiptStatus, 'returned' | 'kept'>,
  opts: { aboveTabBar?: boolean } = {},
): void {
  flushStatus(id);
  const store = useReceipts.getState();
  store.setPendingStatus(id, status);
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

  const commit = () => {
    timers.delete(id);
    setReceiptStatus(uid, id, status);
  };
  const timer = setTimeout(commit, UNDO_MS);
  timers.set(id, { timer, commit });

  useSnackbar.getState().show({
    message: status === 'returned' ? 'Marked as returned' : 'Marked as kept',
    actionLabel: 'Undo',
    durationMs: UNDO_MS,
    aboveTabBar: opts.aboveTabBar,
    onAction: () => undoStatus(id),
  });
}

export function undoStatus(id: string): void {
  const t = timers.get(id);
  if (t) clearTimeout(t.timer);
  timers.delete(id);
  useReceipts.getState().setPendingStatus(id, null);
}

/** Saves a waiting change now (another change to the same receipt, or signing out). */
export function flushStatus(id?: string): void {
  for (const [key, t] of [...timers]) {
    if (id && key !== id) continue;
    clearTimeout(t.timer);
    t.commit();
  }
}
