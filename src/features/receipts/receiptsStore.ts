import { useMemo } from 'react';
import { create } from 'zustand';

import type { CustomStore, Receipt, ReceiptStatus, UserProfile } from './types';

type ReceiptsState = {
  uid: string | null;
  /** False until the first snapshot arrives (shows the loading skeleton). */
  loaded: boolean;
  /** Set when the listener fails; the list shows Retry. */
  error: boolean;
  receipts: Receipt[];
  profile: UserProfile | null;
  customStores: CustomStore[];
  /**
   * Status shown during the 5-second Undo window. The write happens only when the window ends,
   * so Undo never touches the server and the free-limit counter never flips back and forth.
   */
  pendingStatus: Record<string, ReceiptStatus>;
  /** Bumped by Retry so the provider subscribes again. */
  attempt: number;
  retry: () => void;
  reset: (uid: string | null) => void;
  setReceipts: (receipts: Receipt[]) => void;
  setProfile: (profile: UserProfile | null) => void;
  setCustomStores: (stores: CustomStore[]) => void;
  setError: (error: boolean) => void;
  setPendingStatus: (id: string, status: ReceiptStatus | null) => void;
};

export const useReceipts = create<ReceiptsState>((set) => ({
  uid: null,
  loaded: false,
  error: false,
  receipts: [],
  profile: null,
  customStores: [],
  pendingStatus: {},
  attempt: 0,
  retry: () => set((s) => ({ attempt: s.attempt + 1, error: false, loaded: false })),
  reset: (uid) =>
    set({
      uid,
      loaded: false,
      error: false,
      receipts: [],
      profile: null,
      customStores: [],
      pendingStatus: {},
    }),
  setReceipts: (receipts) =>
    set((s) => {
      // Drop a pending status once the saved receipt shows it (or the receipt is gone).
      const pendingStatus = { ...s.pendingStatus };
      for (const [id, status] of Object.entries(pendingStatus)) {
        const r = receipts.find((x) => x.id === id);
        if (!r || r.status === status) delete pendingStatus[id];
      }
      return { receipts, loaded: true, error: false, pendingStatus };
    }),
  setProfile: (profile) => set({ profile }),
  setCustomStores: (customStores) => set({ customStores }),
  setError: (error) => set({ error, loaded: true }),
  setPendingStatus: (id, status) =>
    set((s) => {
      const pendingStatus = { ...s.pendingStatus };
      if (status) pendingStatus[id] = status;
      else delete pendingStatus[id];
      return { pendingStatus };
    }),
}));

/** Receipts with any Undo-window status applied, as every screen should show them. */
export function useVisibleReceipts(): Receipt[] {
  const receipts = useReceipts((s) => s.receipts);
  const pending = useReceipts((s) => s.pendingStatus);
  return useMemo(() => {
    if (Object.keys(pending).length === 0) return receipts;
    return receipts.map((r) => (pending[r.id] ? { ...r, status: pending[r.id] } : r));
  }, [receipts, pending]);
}
