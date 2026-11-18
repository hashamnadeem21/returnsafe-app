/**
 * Reminder rows: reminders/{id} = { uid, receiptId, kind, daysBefore, sendAt, sent }. Only the
 * server reads or writes them. A receipt's rows are rebuilt whenever the receipt or the owner's
 * reminder settings change; rows already sent are kept so nothing is sent twice.
 */
import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';

import { db } from '../admin.js';
import { DEFAULT_TIMEZONE, validTimezone } from '../userDefaults.js';
import {
  cleanReminderDays,
  cleanReminderHour,
  FREE_REMINDER_DAYS,
  isIsoDate,
  localHourToUtc,
  addCalendarDays,
  reminderInstants,
  WARRANTY_DAYS_BEFORE,
} from './schedule.js';
import type { ReminderKind } from './text.js';

export const REMINDERS = 'reminders';

export type ReminderRow = {
  uid: string;
  receiptId: string;
  kind: ReminderKind;
  daysBefore: number;
  sendAt: Timestamp;
  sent: boolean;
};

/** The reminder settings that decide which rows a receipt gets. */
export type ReminderSettings = {
  isPro: boolean;
  enabled: boolean;
  days: number[];
  hour: number;
  timezone: string;
};

export function settingsFrom(user: DocumentData | undefined): ReminderSettings | null {
  if (!user) return null;
  return {
    isPro: user.isPro === true,
    enabled: user.remindersEnabled !== false,
    days: cleanReminderDays(user.reminderDays),
    hour: cleanReminderHour(user.reminderHour),
    timezone: validTimezone(user.timezone ?? DEFAULT_TIMEZONE),
  };
}

/** The receipt fields that decide its rows; a change to anything else leaves them alone. */
export function scheduleKey(receipt: DocumentData | undefined): string {
  if (!receipt) return '';
  return [receipt.status, receipt.returnDeadline, receipt.warrantyEnd ?? ''].join('|');
}

export function rowId(uid: string, receiptId: string, kind: ReminderKind, at: Date): string {
  return `${uid}_${receiptId}_${kind}_${at.getTime()}`;
}

/**
 * The rows a receipt should have from now on:
 * - Return: while the receipt is active and return reminders are on. Free users get the day
 *   before; Pro users get their chosen days (7, 3 and 1 by default).
 * - Warranty (Pro only): 30 days before the warranty ends, unless the item was returned.
 * All at the user's reminder hour in their time zone. Times already past are skipped.
 */
export function wantedRows(
  uid: string,
  receiptId: string,
  receipt: DocumentData | undefined,
  settings: ReminderSettings | null,
  now: Date,
): Map<string, ReminderRow> {
  const rows = new Map<string, ReminderRow>();
  if (!receipt || !settings) return rows;
  const add = (kind: ReminderKind, daysBefore: number, at: Date) => {
    if (at.getTime() <= now.getTime()) return;
    rows.set(rowId(uid, receiptId, kind, at), {
      uid,
      receiptId,
      kind,
      daysBefore,
      sendAt: Timestamp.fromDate(at),
      sent: false,
    });
  };

  if (receipt.status === 'active' && settings.enabled && isIsoDate(receipt.returnDeadline)) {
    const days = settings.isPro ? settings.days : FREE_REMINDER_DAYS;
    for (const r of reminderInstants(
      receipt.returnDeadline,
      days,
      settings.hour,
      settings.timezone,
    )) {
      add('return', r.daysBefore, r.at);
    }
  }

  if (settings.isPro && receipt.status !== 'returned' && isIsoDate(receipt.warrantyEnd)) {
    const day = addCalendarDays(receipt.warrantyEnd, -WARRANTY_DAYS_BEFORE);
    add('warranty', WARRANTY_DAYS_BEFORE, localHourToUtc(day, settings.hour, settings.timezone));
  }
  return rows;
}

/**
 * Makes a receipt's unsent rows match what it should have: unsent rows that are no longer wanted
 * are deleted, missing ones are added, and rows already sent are left as they are. Safe to repeat.
 */
export async function rebuildReceiptReminders(
  uid: string,
  receiptId: string,
  receipt: DocumentData | undefined,
  settings: ReminderSettings | null,
  now: Date = new Date(),
): Promise<void> {
  const wanted = wantedRows(uid, receiptId, receipt, settings, now);
  const existing = await db
    .collection(REMINDERS)
    .where('uid', '==', uid)
    .where('receiptId', '==', receiptId)
    .get();

  const batch = db.batch();
  let writes = 0;
  for (const doc of existing.docs) {
    if (wanted.has(doc.id)) wanted.delete(doc.id);
    else if (doc.get('sent') !== true) {
      batch.delete(doc.ref);
      writes++;
    }
  }
  for (const [id, row] of wanted) {
    batch.set(db.collection(REMINDERS).doc(id), {
      ...row,
      createdAt: FieldValue.serverTimestamp(),
    });
    writes++;
  }
  if (writes > 0) await batch.commit();
}

/** Rebuilds every receipt's rows for a user, after their plan or reminder settings change. */
export async function rebuildUserReminders(uid: string, now: Date = new Date()): Promise<void> {
  const user = await db.doc(`users/${uid}`).get();
  const settings = settingsFrom(user.data());
  const receipts = await db.collection(`users/${uid}/receipts`).get();
  for (const r of receipts.docs) {
    await rebuildReceiptReminders(uid, r.id, r.data(), settings, now);
  }
}

/** Deletes every row of a user, sent or not (their account is being deleted). */
export async function deleteUserReminders(uid: string): Promise<void> {
  const rows = await db.collection(REMINDERS).where('uid', '==', uid).get();
  const writer = db.bulkWriter();
  for (const doc of rows.docs) void writer.delete(doc.ref);
  await writer.close();
}
