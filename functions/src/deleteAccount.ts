import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

import { adminAuth, bucket, db } from './admin.js';

/** A sign-in older than this must re-authenticate before deleting (same window Firebase uses). */
export const RECENT_LOGIN_SECONDS = 5 * 60;

/** Removes every trace of a user: Firestore (doc + subcollections), Storage photos, then the auth user. */
export async function deleteUserEverything(uid: string): Promise<void> {
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await bucket().deleteFiles({ prefix: `users/${uid}/` });
  await adminAuth.deleteUser(uid);
}

export const deleteAccount = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  // Guests cannot re-authenticate, so only real accounts need a recent login.
  const isGuest = req.auth?.token.firebase?.sign_in_provider === 'anonymous';
  const authTime = Number(req.auth?.token.auth_time ?? 0);
  if (!isGuest && Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) {
    throw new HttpsError('failed-precondition', 'Sign in again to delete your account.', {
      reason: 'requires-recent-login',
    });
  }

  await deleteUserEverything(uid);
  logger.info('Account deleted', { uid });
  return { deleted: true };
});
