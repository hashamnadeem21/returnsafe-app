import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminAuth, bucket, db } from './admin.js';
import { deleteUserEverything } from './deleteAccount.js';

type MergeData = { guestIdToken?: unknown };

/** Moves a receipt photo from the guest's Storage folder to the account's. Missing files are skipped. */
async function movePhoto(path: unknown, from: string, to: string): Promise<string | null> {
  if (typeof path !== 'string') return null;
  const prefix = `users/${from}/`;
  if (!path.startsWith(prefix)) return path;
  const target = `users/${to}/${path.slice(prefix.length)}`;
  try {
    await bucket().file(path).move(target);
  } catch (e) {
    // Already moved by an earlier, interrupted call, or never uploaded.
    const exists = await bucket()
      .file(target)
      .exists()
      .then(([x]) => x)
      .catch(() => false);
    if (!exists) {
      logger.warn('Guest photo not moved', { path, error: String(e) });
      return null;
    }
  }
  return target;
}

/** Copies the guest's receipts (with photos) and custom stores into the account. Returns how many receipts moved. */
export async function moveGuestData(from: string, to: string): Promise<number> {
  const receipts = await db.collection(`users/${from}/receipts`).get();
  const writer = db.bulkWriter();
  for (const doc of receipts.docs) {
    const data = doc.data();
    const paths = Array.isArray(data.photoPaths) ? data.photoPaths : [];
    const photoPaths = (await Promise.all(paths.map((p) => movePhoto(p, from, to)))).filter(
      (p): p is string => p !== null,
    );
    // Receipt ids are random, so the guest's id is kept; a retry overwrites the same document.
    void writer.set(db.doc(`users/${to}/receipts/${doc.id}`), {
      ...data,
      photoPaths,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // The account's own custom store windows win over the guest's.
  const [guestStores, ownStores] = await Promise.all([
    db.collection(`users/${from}/customStores`).get(),
    db.collection(`users/${to}/customStores`).get(),
  ]);
  const own = new Set(ownStores.docs.map((d) => d.id));
  for (const doc of guestStores.docs) {
    if (!own.has(doc.id)) void writer.set(db.doc(`users/${to}/customStores/${doc.id}`), doc.data());
  }
  await writer.close();
  return receipts.size;
}

/**
 * A guest signed in to an existing account: move the guest's receipts, photos and custom stores
 * into it, then delete the guest account. The guest's ID token (captured before the switch) proves
 * the caller owned the guest account.
 */
export const mergeGuestAccount = onCall<MergeData>(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const token = req.data?.guestIdToken;
  if (typeof token !== 'string' || token.length === 0) {
    throw new HttpsError('invalid-argument', 'guestIdToken is required.');
  }
  const guest = await adminAuth.verifyIdToken(token).catch(() => null);
  if (!guest || guest.firebase.sign_in_provider !== 'anonymous') {
    throw new HttpsError('permission-denied', 'That is not a guest account.');
  }
  if (guest.uid === uid)
    throw new HttpsError('invalid-argument', 'Already signed in as the guest.');

  const record = await adminAuth.getUser(guest.uid).catch(() => null);
  // Already merged (and deleted) by an earlier call.
  if (!record) return { moved: 0 };
  // A token issued before the guest saved their account still says "anonymous"; the record does not.
  if (record.providerData.length > 0) {
    throw new HttpsError('permission-denied', 'That is not a guest account.');
  }

  const moved = await moveGuestData(guest.uid, uid);
  await deleteUserEverything(guest.uid);
  logger.info('Guest account merged', { from: guest.uid, to: uid, moved });
  return { moved };
});
