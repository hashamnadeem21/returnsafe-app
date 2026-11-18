import { create } from 'zustand';

import { useReceipts } from '@/features/receipts/receiptsStore';

type ProState = {
  /** The "pro" entitlement in RevenueCat's customerInfo (instant after a purchase or restore). */
  storePro: boolean;
  /** Store page where the user manages the subscription, from customerInfo. */
  managementURL: string | null;
  setCustomer: (storePro: boolean, managementURL: string | null) => void;
  reset: () => void;
};

export const usePro = create<ProState>((set) => ({
  storePro: false,
  managementURL: null,
  setCustomer: (storePro, managementURL) => set({ storePro, managementURL }),
  reset: () => set({ storePro: false, managementURL: null }),
}));

/**
 * Pro for the UI: RevenueCat's answer right away, or the server's users/{uid}.isPro (which the
 * rules and functions use, and which covers Pro granted without the stores).
 */
export function useIsPro(): boolean {
  const serverPro = useReceipts((s) => s.profile?.isPro ?? false);
  const storePro = usePro((s) => s.storePro);
  return serverPro || storePro;
}

/** The same as useIsPro, read once outside React. */
export function isProNow(): boolean {
  return (useReceipts.getState().profile?.isPro ?? false) || usePro.getState().storePro;
}
