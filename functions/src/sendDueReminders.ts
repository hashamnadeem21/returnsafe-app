import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging, type BatchResponse, type MulticastMessage } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { db } from './admin.js';
import { REMINDERS } from './reminders/rebuild.js';
import { daysUntil } from './reminders/schedule.js';
import { reminderText, type ReminderKind } from './reminders/text.js';
import { DEFAULT_TIMEZONE, validTimezone } from './userDefaults.js';

/** Android channel created by the app (modules/reminder-channel). */
export const REMINDER_CHANNEL_ID = 'return-reminders';
const BATCH = 200;

/** FCM error codes that mean a token will never work again. */
const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export type Sender = (message: MulticastMessage) => Promise<Pick<BatchResponse, 'responses'>>;

const fcmSender: Sender = (message) => getMessaging().sendEachForMulticast(message);

export function reminderMessage(
  tokens: string[],
  receiptId: string,
  text: { title: string; body: string },
): MulticastMessage {
  return {
    tokens,
    notification: text,
    // The app opens receipt/[id] from this when the notification is tapped.
    data: { receiptId },
    android: { priority: 'high', notification: { channelId: REMINDER_CHANNEL_ID } },
    apns: { payload: { aps: { sound: 'default' } } },
  };
}

/**
 * Sends every unsent reminder whose time has come, then marks it sent. A row whose receipt is
 * gone, no longer active (return reminders) or past its date is dropped without sending. Tokens
 * FCM reports as dead are removed from the user. Returns how many pushes went out.
 */
export async function sendDue(now: Date = new Date(), send: Sender = fcmSender): Promise<number> {
  let sentCount = 0;
  for (;;) {
    const due = await db
      .collection(REMINDERS)
      .where('sent', '==', false)
      .where('sendAt', '<=', Timestamp.fromDate(now))
      .orderBy('sendAt')
      .limit(BATCH)
      .get();
    if (due.empty) return sentCount;

    for (const row of due.docs) {
      const uid = row.get('uid') as string;
      const receiptId = row.get('receiptId') as string;
      const kind = row.get('kind') as ReminderKind;
      const [user, receipt] = await Promise.all([
        db.doc(`users/${uid}`).get(),
        db.doc(`users/${uid}/receipts/${receiptId}`).get(),
      ]);
      const tz = validTimezone(user.get('timezone') ?? DEFAULT_TIMEZONE);
      const date = kind === 'return' ? receipt.get('returnDeadline') : receipt.get('warrantyEnd');
      const stillDue =
        user.exists &&
        receipt.exists &&
        typeof date === 'string' &&
        daysUntil(date, tz, now) >= 0 &&
        (kind === 'return'
          ? receipt.get('status') === 'active'
          : receipt.get('status') !== 'returned');
      if (!stillDue) {
        await row.ref.delete();
        continue;
      }

      const tokens = ((user.get('fcmTokens') as unknown[] | undefined) ?? []).filter(
        (t): t is string => typeof t === 'string' && t.length > 0,
      );
      if (tokens.length > 0) {
        const text = reminderText({
          kind,
          storeName: String(receipt.get('storeName') ?? ''),
          daysLeft: daysUntil(date, tz, now),
          amountCents: Number(receipt.get('amountCents') ?? 0),
          items: ((receipt.get('items') as unknown[] | undefined) ?? []).map(String),
        });
        const result = await send(reminderMessage(tokens, receiptId, text));
        const dead = tokens.filter((_, i) => {
          const code = result.responses[i]?.error?.code;
          return code !== undefined && DEAD_TOKEN.has(code);
        });
        if (dead.length > 0) {
          await user.ref.update({ fcmTokens: FieldValue.arrayRemove(...dead) });
        }
        if (result.responses.some((r) => r.success)) sentCount++;
      }
      // Marked sent even without a device, so it is never retried every 15 minutes.
      await row.ref.update({ sent: true, sentAt: FieldValue.serverTimestamp() });
    }
  }
}

/** Every 15 minutes: send the reminders that are due. */
export const sendDueReminders = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'Etc/UTC' },
  async () => {
    const count = await sendDue();
    logger.info('Reminders sent', { count });
  },
);
