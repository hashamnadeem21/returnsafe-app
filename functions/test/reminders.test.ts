/** Reminder functions against the emulators: onReceiptWrite/onUserWrite rows, sending and expiry. */
import { formatInTimeZone } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';

// helpers first: it initialises the Admin SDK for the emulator project.
import { call, db, receipt, signUp } from './helpers';
import { expireDue } from '../src/expireReceipts.js';
import { addCalendarDays, todayIn } from '../src/reminders/schedule.js';
import { sendDue, type Sender } from '../src/sendDueReminders.js';

const CHICAGO = 'America/Chicago';

type Row = { id: string; kind: string; daysBefore: number; sendAt: Date; sent: boolean };

async function rowsFor(uid: string, receiptId: string): Promise<Row[]> {
  const snap = await db
    .collection('reminders')
    .where('uid', '==', uid)
    .where('receiptId', '==', receiptId)
    .get();
  return snap.docs
    .map((d) => ({
      id: d.id,
      kind: d.get('kind') as string,
      daysBefore: d.get('daysBefore') as number,
      sendAt: d.get('sendAt').toDate() as Date,
      sent: d.get('sent') as boolean,
    }))
    .sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
}

/** Waits for the triggers to leave a receipt with rows that pass `check`. */
async function waitForRows(
  uid: string,
  receiptId: string,
  check: (rows: Row[]) => boolean,
  timeoutMs = 20000,
): Promise<Row[]> {
  const end = Date.now() + timeoutMs;
  let rows: Row[] = [];
  while (Date.now() < end) {
    rows = await rowsFor(uid, receiptId);
    if (check(rows)) return rows;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Reminder rows never matched: ${JSON.stringify(rows)}`);
}

/** A signed-up user in Chicago with a profile; `fields` are set on users/{uid} afterwards. */
async function user(fields: Record<string, unknown> = {}) {
  const me = await signUp(`rem-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`);
  await call('initUser', { timezone: CHICAGO }, me.idToken);
  if (Object.keys(fields).length > 0) await db.doc(`users/${me.uid}`).update(fields);
  return me.uid;
}

/** A deadline `days` days from today in Chicago. */
const inDays = (days: number) => addCalendarDays(todayIn(CHICAGO, new Date()), days);
const localTime = (d: Date) => formatInTimeZone(d, CHICAGO, 'yyyy-MM-dd HH:mm');

describe('reminder rows (onReceiptWrite)', () => {
  it('TC-503: a Pro receipt gets 3 rows, 7, 3 and 1 day before at 9:00 Chicago time', async () => {
    const uid = await user({ isPro: true });
    const deadline = inDays(30);
    const ref = await db
      .collection(`users/${uid}/receipts`)
      .add(receipt({ returnDeadline: deadline }));

    const rows = await waitForRows(uid, ref.id, (r) => r.length === 3);
    expect(rows.map((r) => [r.kind, r.daysBefore, localTime(r.sendAt), r.sent])).toEqual([
      ['return', 7, `${addCalendarDays(deadline, -7)} 09:00`, false],
      ['return', 3, `${addCalendarDays(deadline, -3)} 09:00`, false],
      ['return', 1, `${addCalendarDays(deadline, -1)} 09:00`, false],
    ]);
  });

  it('TC-504: the same receipt for a Free user gets 1 row, the day before', async () => {
    const uid = await user();
    const deadline = inDays(30);
    const ref = await db
      .collection(`users/${uid}/receipts`)
      .add(receipt({ returnDeadline: deadline }));

    const rows = await waitForRows(uid, ref.id, (r) => r.length === 1);
    expect(rows.map((r) => [r.kind, r.daysBefore, localTime(r.sendAt)])).toEqual([
      ['return', 1, `${addCalendarDays(deadline, -1)} 09:00`],
    ]);
  });

  it('TC-506: marking the receipt Returned deletes its unsent rows', async () => {
    const uid = await user({ isPro: true });
    const ref = await db
      .collection(`users/${uid}/receipts`)
      .add(receipt({ returnDeadline: inDays(30) }));
    await waitForRows(uid, ref.id, (r) => r.length === 3);

    await ref.update({ status: 'returned' });
    expect(await waitForRows(uid, ref.id, (r) => r.length === 0)).toEqual([]);
  });

  it('skips times already past and moves the rows when the deadline changes', async () => {
    const uid = await user({ isPro: true });
    const ref = await db
      .collection(`users/${uid}/receipts`)
      .add(receipt({ returnDeadline: inDays(5) }));
    // 7 days before is already past; 3 and 1 are not.
    const first = await waitForRows(uid, ref.id, (r) => r.length === 2);
    expect(first.map((r) => r.daysBefore)).toEqual([3, 1]);

    const later = inDays(20);
    await ref.update({ returnDeadline: later });
    const moved = await waitForRows(
      uid,
      ref.id,
      (r) => r.length === 3 && r.every((x) => !first.some((f) => f.id === x.id)),
    );
    expect(localTime(moved[2].sendAt)).toBe(`${addCalendarDays(later, -1)} 09:00`);
  });

  it('keeps a row that was already sent instead of sending it again', async () => {
    const uid = await user();
    const ref = await db
      .collection(`users/${uid}/receipts`)
      .add(receipt({ returnDeadline: inDays(10) }));
    const [row] = await waitForRows(uid, ref.id, (r) => r.length === 1);
    await db.doc(`reminders/${row.id}`).update({ sent: true });

    await ref.update({ status: 'kept' });
    await ref.update({ status: 'active' });
    await new Promise((r) => setTimeout(r, 2000));
    const rows = await rowsFor(uid, ref.id);
    expect(rows.map((r) => [r.id, r.sent])).toEqual([[row.id, true]]);
  });

  it('adds a Pro warranty reminder 30 days before coverage ends, kept after the return window', async () => {
    const uid = await user({ isPro: true });
    const warrantyEnd = inDays(400);
    const ref = await db
      .collection(`users/${uid}/receipts`)
      .add(receipt({ returnDeadline: inDays(30), warrantyMonths: 12, warrantyEnd }));
    await waitForRows(uid, ref.id, (r) => r.length === 4);

    await ref.update({ status: 'kept' });
    const rows = await waitForRows(uid, ref.id, (r) => r.length === 1);
    expect(rows.map((r) => [r.kind, r.daysBefore, localTime(r.sendAt)])).toEqual([
      ['warranty', 30, `${addCalendarDays(warrantyEnd, -30)} 09:00`],
    ]);
  });

  it('deletes the rows when the receipt is deleted', async () => {
    const uid = await user();
    const ref = await db
      .collection(`users/${uid}/receipts`)
      .add(receipt({ returnDeadline: inDays(10) }));
    await waitForRows(uid, ref.id, (r) => r.length === 1);
    await ref.delete();
    await waitForRows(uid, ref.id, (r) => r.length === 0);
  });
});

describe('reminder settings (onUserWrite)', () => {
  it('rebuilds rows when the plan, reminders switch, days or hour change', async () => {
    const uid = await user({ isPro: true });
    const deadline = inDays(30);
    const ref = await db
      .collection(`users/${uid}/receipts`)
      .add(receipt({ returnDeadline: deadline }));
    await waitForRows(uid, ref.id, (r) => r.length === 3);
    const userRef = db.doc(`users/${uid}`);

    await userRef.update({ reminderDays: [3], reminderHour: 18 });
    let rows = await waitForRows(uid, ref.id, (r) => r.length === 1 && r[0].daysBefore === 3);
    expect(localTime(rows[0].sendAt)).toBe(`${addCalendarDays(deadline, -3)} 18:00`);

    await userRef.update({ remindersEnabled: false });
    await waitForRows(uid, ref.id, (r) => r.length === 0);

    await userRef.update({ remindersEnabled: true, isPro: false });
    rows = await waitForRows(uid, ref.id, (r) => r.length === 1 && r[0].daysBefore === 1);
    expect(localTime(rows[0].sendAt)).toBe(`${addCalendarDays(deadline, -1)} 18:00`);
  });
});

describe('sendDueReminders', () => {
  it('sends a due reminder once, with the receipt id, and removes dead tokens', async () => {
    const uid = await user({ fcmTokens: ['good-token', 'dead-token'] });
    const ref = await db.collection(`users/${uid}/receipts`).add(
      receipt({
        storeName: 'Target',
        amountCents: 4820,
        items: ['Kids sneakers', 'bath towels'],
        returnDeadline: inDays(10),
      }),
    );
    const [row] = await waitForRows(uid, ref.id, (r) => r.length === 1);

    const sent: Parameters<Sender>[0][] = [];
    const sender: Sender = async (m) => {
      sent.push(m);
      return {
        responses: m.tokens.map((t) =>
          t === 'dead-token'
            ? {
                success: false,
                error: { code: 'messaging/registration-token-not-registered' },
              }
            : { success: true },
        ) as Awaited<ReturnType<Sender>>['responses'],
      };
    };

    const due = new Date(row.sendAt.getTime() + 60_000);
    await sendDue(due, sender);
    const mine = sent.filter((m) => m.data?.receiptId === ref.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      tokens: ['good-token', 'dead-token'],
      notification: {
        title: 'Target return closes in 1 day',
        body: '$48.20 · Kids sneakers, bath towels',
      },
      data: { receiptId: ref.id },
      android: { notification: { channelId: 'return-reminders' } },
    });
    expect((await db.doc(`users/${uid}`).get()).get('fcmTokens')).toEqual(['good-token']);
    expect((await db.doc(`reminders/${row.id}`).get()).get('sent')).toBe(true);

    // Running again sends nothing more for this receipt.
    await sendDue(due, sender);
    expect(sent.filter((m) => m.data?.receiptId === ref.id)).toHaveLength(1);
  });

  it('does not send for a receipt that is gone, and drops its row', async () => {
    const uid = await user({ fcmTokens: ['good-token'] });
    const ref = await db
      .collection(`users/${uid}/receipts`)
      .add(receipt({ returnDeadline: inDays(10) }));
    const [row] = await waitForRows(uid, ref.id, (r) => r.length === 1);
    // The receipt is deleted but its row is still there, as if the delete raced with the sender.
    await ref.delete();
    await waitForRows(uid, ref.id, (r) => r.length === 0);
    await db.doc(`reminders/${row.id}`).set({
      uid,
      receiptId: ref.id,
      kind: 'return',
      daysBefore: 1,
      sendAt: row.sendAt,
      sent: false,
    });

    const sent: string[] = [];
    await sendDue(new Date(row.sendAt.getTime() + 60_000), async (m) => {
      sent.push(String(m.data?.receiptId));
      return {
        responses: m.tokens.map(() => ({ success: true })) as Awaited<
          ReturnType<Sender>
        >['responses'],
      };
    });
    expect(sent).not.toContain(ref.id);
    expect((await db.doc(`reminders/${row.id}`).get()).exists).toBe(false);
  });
});

describe('expireReceipts', () => {
  it('TC-507: an active receipt past its deadline becomes expired; the deadline day does not', async () => {
    const uid = await user();
    const col = db.collection(`users/${uid}/receipts`);
    const past = await col.add(receipt({ returnDeadline: inDays(-1) }));
    const today = await col.add(receipt({ returnDeadline: inDays(0) }));
    const returned = await col.add(receipt({ returnDeadline: inDays(-3), status: 'returned' }));

    await expireDue(new Date());
    expect((await past.get()).get('status')).toBe('expired');
    expect((await past.get()).get('statusChangedAt')).toBeDefined();
    expect((await today.get()).get('status')).toBe('active');
    expect((await returned.get()).get('status')).toBe('returned');
  });
});
