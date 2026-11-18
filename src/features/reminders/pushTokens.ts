/**
 * This device's push token, saved in users/{uid}.fcmTokens so the server can send reminders.
 * The server removes tokens FCM reports as dead; the app removes its own on sign-out.
 */
import {
  arrayRemove,
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getMessaging, getToken, onTokenRefresh } from '@react-native-firebase/messaging';

import { db } from '@/lib/firebase';

let current: { uid: string; token: string } | null = null;

async function save(uid: string, token: string): Promise<void> {
  // Remembered before the write settles: offline it only settles once back online.
  current = { uid, token };
  await updateDoc(doc(db(), 'users', uid), {
    fcmTokens: arrayUnion(token),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Saves the token for this user, and again whenever FCM issues a new one. Returns a function
 * that stops listening. Never throws: without a token the app works, just without pushes.
 */
export function registerPushToken(uid: string): () => void {
  const messaging = getMessaging();
  getToken(messaging)
    .then((token) => save(uid, token))
    .catch(() => undefined);
  return onTokenRefresh(messaging, (token) => {
    save(uid, token).catch(() => undefined);
  });
}

/**
 * Takes this device off the user's tokens before they sign out. Not awaited: sign-out already
 * waits for pending writes, and it must never fail because of this.
 */
export function unregisterPushToken(): void {
  const saved = current;
  current = null;
  if (!saved) return;
  updateDoc(doc(db(), 'users', saved.uid), {
    fcmTokens: arrayRemove(saved.token),
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);
}
