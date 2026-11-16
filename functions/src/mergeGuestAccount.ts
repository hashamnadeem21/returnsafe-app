import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminAuth, bucket, db } from './admin.js';
import { deleteUserEverything } from './deleteAccount.js';

type MergeData = { guestIdToken?: unknown };

/**
 * Moves a receipt photo from the guest's Storage folder to the account's. A photo missing from the
 * guest's folder is skipped. Any other failure is thrown, so the guest's data is kept and the merge
 * can be retried.
 */
async function movePhoto(path: unknown, from: string, to: string): Promise<string | null> {
  if (typeof path !== 'string') return null;
  const prefix = `users/${from}/`;
  if (!path.startsWith(prefix)) return path;
  const target = `users/${to}/${path.slice(prefix.length)}`;
  try {
    await bucket().file(path).move(target);
    return target;
  } catch (e) {
    const [sourceExists] = await bucket().file(path).exists();
    if (sourceExists) throw e;
    // Already moved by an earlier, interrupted call, or never uploaded.
    const [targetExists] = await bucket().file(target).exists();
    if (targetExists) return target;
    logger.warn('Guest photo missing, skipped', { path });
    return null;
  }
}

/** Copies the guest's receipts (with photos) and custom stores into the account. Returns how many receipts moved. */
export async function moveGuestData(from: string, to: string): Promise<number> {
  const receipts = await db.collection(`users/${from}/receipts`).get();
  const writer = db.bulkWriter();
  // close() does not report failed writes, so each write's result is kept and checked.
  const writes: Promise<unknown>[] = [];
  const set = (path: string, data: DocumentData) =>
    writes.push(
      writer.set(db.doc(path), data).then(
        () => null,
        (e: unknown) => e ?? new Error('Write failed'),
      ),
    );

  for (const doc of receipts.docs) {
    const data = doc.data();
    const paths = Array.isArray(data.photoPaths) ? data.photoPaths : [];
    const photoPaths = (await Promise.all(paths.map((p) => movePhoto(p, from, to)))).filter(
      (p): p is string => p !== null,
    );
    // Receipt ids are random, so the guest's id is kept; a retry overwrites the same document.
    set(`users/${to}/receipts/${doc.id}`, {
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
    if (!own.has(doc.id)) set(`users/${to}/customStores/${doc.id}`, doc.data());
  }
  await writer.close();
  // Stop before the guest's data is deleted if anything failed to copy.
  const failed = (await Promise.all(writes)).find((e) => e !== null);
  if (failed) throw failed;
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

  // Only a confirmed missing guest means "already merged"; other errors are thrown so it can be retried.
  const record = await adminAuth.getUser(guest.uid).catch((e: unknown) => {
    if ((e as { code?: unknown }).code === 'auth/user-not-found') return null;
    throw e;
  });
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
