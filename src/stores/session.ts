import type { User } from '@react-native-firebase/auth';
import { create } from 'zustand';

export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  emailVerified: boolean;
  providers: string[];
};

type SessionState = {
  /** False until Firebase reports the first auth state on launch. */
  ready: boolean;
  user: SessionUser | null;
  /** Set right after sign-up so the notification primer shows before Home. */
  showPrimer: boolean;
  setUser: (user: User | null) => void;
  setShowPrimer: (show: boolean) => void;
};

export function toSessionUser(user: User): SessionUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    isAnonymous: user.isAnonymous,
    emailVerified: user.emailVerified,
    providers: user.providerData.map((p) => p.providerId),
  };
}

export const useSession = create<SessionState>((set) => ({
  ready: false,
  user: null,
  showPrimer: false,
  setUser: (user) => set({ ready: true, user: user ? toSessionUser(user) : null }),
  setShowPrimer: (showPrimer) => set({ showPrimer }),
}));
