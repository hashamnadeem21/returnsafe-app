/**
 * Whether the phone is online. Writes still work offline (Firestore keeps them and syncs later);
 * this only drives the "You're offline" banner.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

type NetworkState = { online: boolean; set: (online: boolean) => void };

export const useNetwork = create<NetworkState>((set) => ({
  online: true,
  set: (online) => set({ online }),
}));

/** Offline only when the phone says so; "unknown" counts as online, so the banner never flickers. */
export function isOnline(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/** Follows the connection from now on; returns the stop function. */
export function watchNetwork(): () => void {
  return NetInfo.addEventListener((state) => useNetwork.getState().set(isOnline(state)));
}

export const useOnline = () => useNetwork((s) => s.online);
