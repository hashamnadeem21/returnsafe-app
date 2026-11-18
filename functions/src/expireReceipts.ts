import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { db } from './admin.js';
import { daysUntil, todayIn } from './reminders/schedule.js';
import { DEFAULT_TIMEZONE, validTimezone } from './userDefaults.js';

/** The time zone where the date changes first, so no receipt past its deadline is missed. */
const EARLIEST_ZONE = 'Pacific/Kiritimati';

/**
 * Marks active receipts whose return deadline has passed in their owner's time zone as expired.
 * The deadline day itself still counts. onReceiptWrite then drops their unsent reminders and
 * updates the free-limit counter. Returns how many receipts changed.
 */
export async function expireDue(now: Date = new Date()): Promise<number> {
  const candidates = await db
    .collectionGroup('receipts')
    .where('status', '==', 'active')
    .where('returnDeadline', '<', todayIn(EARLIEST_ZONE, now))
    .get();

  const zones = new Map<string, string>();
  let count = 0;
  for (const doc of candidates.docs) {
    const userRef = doc.ref.parent.parent;
    if (!userRef) continue;
    if (!zones.has(userRef.id)) {
      const user = await userRef.get();
      zones.set(userRef.id, validTimezone(user.get('timezone') ?? DEFAULT_TIMEZONE));
    }
    const tz = zones.get(userRef.id) ?? DEFAULT_TIMEZONE;
    if (daysUntil(doc.get('returnDeadline') as string, tz, now) >= 0) continue;
    // Only if it is still active: the user may have marked it returned meanwhile.
    const expired = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (fresh.get('status') !== 'active') return false;
      tx.update(doc.ref, {
        status: 'expired',
        statusChangedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (expired) count++;
  }
  return count;
}

/** Daily, after midnight in every US time zone. */
export const expireReceipts = onSchedule(
  { schedule: '15 3 * * *', timeZone: 'America/Los_Angeles' },
  async () => {
    const count = await expireDue();
    logger.info('Receipts expired', { count });
  },
);
