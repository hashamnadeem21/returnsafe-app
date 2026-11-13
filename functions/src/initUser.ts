import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminAuth, db } from './admin.js';
import { cleanName, USER_DEFAULTS, validTimezone } from './userDefaults.js';

type InitUserData = { timezone?: unknown; displayName?: unknown };

/**
 * Called by the app after every sign-in. Creates users/{uid} with server-side defaults the first time
 * (isPro is only ever written here and by the billing webhook). Later calls only fill in a missing
 * name and keep the email in step after a guest saves their account.
 */
export const initUser = onCall<InitUserData>(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const record = await adminAuth.getUser(uid);
  const email = record.email ?? null;
  const displayName = cleanName(req.data?.displayName) ?? cleanName(record.displayName) ?? null;
  const ref = db.doc(`users/${uid}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        ...USER_DEFAULTS,
        timezone: validTimezone(req.data?.timezone),
        email,
        displayName,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { created: true };
    }
    const patch: Record<string, unknown> = {};
    if (displayName && !snap.get('displayName')) patch.displayName = displayName;
    if (email && snap.get('email') !== email) patch.email = email;
    if (Object.keys(patch).length > 0) {
      tx.update(ref, { ...patch, updatedAt: FieldValue.serverTimestamp() });
    }
    return { created: false };
  });
});
