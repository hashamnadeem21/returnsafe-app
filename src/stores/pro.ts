import { create } from 'zustand';

import { useReceipts } from '@/features/receipts/receiptsStore';
import { useSession } from '@/stores/session';

type ProState = {
  /** The Firebase uid the stored customer info belongs to. */
  uid: string | null;
  /** The "pro" entitlement in RevenueCat's customerInfo (instant after a purchase or restore). */
  storePro: boolean;
  /** Store page where the user manages the subscription, from customerInfo. */
  managementURL: string | null;
  setCustomer: (uid: string, storePro: boolean, managementURL: string | null) => void;
  reset: () => void;
};

export const usePro = create<ProState>((set) => ({
  uid: null,
  storePro: false,
  managementURL: null,
  setCustomer: (uid, storePro, managementURL) => set({ uid, storePro, managementURL }),
  reset: () => set({ uid: null, storePro: false, managementURL: null }),
}));

const currentUid = () => useSession.getState().user?.uid ?? null;

/** RevenueCat's answer, only when it belongs to the signed-in user (not a previous account). */
function storeProFor(s: ProState, uid: string | null): boolean {
  return uid !== null && s.uid === uid && s.storePro;
}

/** The management URL for the signed-in user, or null. */
export function managementUrlNow(): string | null {
  const s = usePro.getState();
  return s.uid !== null && s.uid === currentUid() ? s.managementURL : null;
}

/**
 * Pro for the UI: RevenueCat's answer right away, or the server's users/{uid}.isPro (which the
 * rules and functions use, and which covers Pro granted without the stores).
 */
export function useIsPro(): boolean {
  const serverPro = useReceipts((s) => s.profile?.isPro ?? false);
  const uid = useSession((s) => s.user?.uid ?? null);
  const storePro = usePro((s) => storeProFor(s, uid));
  return serverPro || storePro;
}

/** The same as useIsPro, read once outside React. */
export function isProNow(): boolean {
  return (
    (useReceipts.getState().profile?.isPro ?? false) || storeProFor(usePro.getState(), currentUid())
  );
}

/** Pro as the server sees it (users/{uid}.isPro), which the rules check on every write. */
export function serverProNow(): boolean {
  return useReceipts.getState().profile?.isPro ?? false;
}

/** Shown when the store says Pro but the server hasn't caught up yet, so a Pro save would fail. */
export const PRO_ACTIVATING_MESSAGE =
  "Pro is still being activated on your account. Your changes aren't saved yet; try again in a moment.";
