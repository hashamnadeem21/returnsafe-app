import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminAuth } from './admin.js';

/**
 * A guest signed in to an existing account instead of saving theirs. Moves the guest's data to the
 * signed-in account. Phase 2 stub: verifies both sides and moves nothing yet (receipts arrive in Phase 3).
 */
export const mergeGuestAccount = onCall<{ guestIdToken?: unknown }>(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const token = req.data?.guestIdToken;
  if (typeof token !== 'string' || token.length === 0) {
    throw new HttpsError('invalid-argument', 'guestIdToken is required.');
  }
  // The guest's token may expire during the native sign-in sheet; it only proves ownership here.
  const guest = await adminAuth.verifyIdToken(token).catch(() => null);
  if (!guest || guest.firebase.sign_in_provider !== 'anonymous') {
    throw new HttpsError('permission-denied', 'That is not a guest account.');
  }
  return { moved: 0 };
});
