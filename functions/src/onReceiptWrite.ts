import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { db } from './admin.js';

/** Sets users/{uid}.activeCount from a count of the user's active receipts (safe to repeat). */
export async function recountActive(uid: string): Promise<void> {
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const user = await tx.get(userRef);
    // The user doc is gone while an account is being deleted or a guest is merged away.
    if (!user.exists) return;
    const active = await tx.get(
      userRef.collection('receipts').where('status', '==', 'active').count(),
    );
    const count = active.data().count;
    if (user.get('activeCount') !== count) {
      tx.update(userRef, { activeCount: count, updatedAt: FieldValue.serverTimestamp() });
    }
  });
}

/**
 * Keeps the free-limit counter in step with the receipts. Recounting instead of adding or
 * subtracting one means a retried or out-of-order event can never leave the counter wrong.
 * Reminder rows are added here in Phase 5.
 */
export const onReceiptWrite = onDocumentWritten(
  'users/{uid}/receipts/{receiptId}',
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    const wasActive = before?.exists === true && before.get('status') === 'active';
    const isActive = after?.exists === true && after.get('status') === 'active';
    if (wasActive === isActive) return;
    await recountActive(event.params.uid);
  },
);
