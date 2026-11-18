/** Pure unit tests (no emulator needed): reminder instants, daylight saving and notification text. */
import { describe, expect, it } from 'vitest';

import { daysUntil, reminderInstants } from '../src/reminders/schedule.js';
import { formatUsd, reminderText } from '../src/reminders/text.js';
import { reminderMessage } from '../src/sendDueReminders.js';

/** UTC time of a reminder `before` days before `deadline` at `hour` local time. */
const at = (deadline: string, before: number, hour: number, tz: string) =>
  reminderInstants(deadline, [before], hour, tz)[0].at.toISOString();

describe('reminder instants', () => {
  it('TC-508: 9 AM in Los Angeles on 2026-12-01 is 17:00 UTC', () => {
    expect(at('2026-12-02', 1, 9, 'America/Los_Angeles')).toBe('2026-12-01T17:00:00.000Z');
  });

  // 2026: daylight saving starts Sunday March 8 and ends Sunday November 1.
  it.each([
    ['America/New_York', '2026-03-07T14:00:00.000Z', '2026-03-08T13:00:00.000Z'],
    ['America/Chicago', '2026-03-07T15:00:00.000Z', '2026-03-08T14:00:00.000Z'],
    ['America/Los_Angeles', '2026-03-07T17:00:00.000Z', '2026-03-08T16:00:00.000Z'],
  ])('DST start in %s: 9 AM the day before and on the day', (tz, dayBefore, onTheDay) => {
    expect(at('2026-03-08', 1, 9, tz)).toBe(dayBefore);
    expect(at('2026-03-09', 1, 9, tz)).toBe(onTheDay);
  });

  it.each([
    ['America/New_York', '2026-10-31T13:00:00.000Z', '2026-11-01T14:00:00.000Z'],
    ['America/Chicago', '2026-10-31T14:00:00.000Z', '2026-11-01T15:00:00.000Z'],
    ['America/Los_Angeles', '2026-10-31T16:00:00.000Z', '2026-11-01T17:00:00.000Z'],
  ])('DST end in %s: 9 AM the day before and on the day', (tz, dayBefore, onTheDay) => {
    expect(at('2026-10-31', 0, 9, tz)).toBe(dayBefore);
    expect(at('2026-11-01', 0, 9, tz)).toBe(onTheDay);
  });

  it('moves an hour that does not exist (2 AM when clocks spring forward) to 3 AM', () => {
    expect(at('2026-03-09', 1, 2, 'America/New_York')).toBe('2026-03-08T07:00:00.000Z');
  });

  it('fires once for an hour that happens twice (1 AM when clocks fall back)', () => {
    expect(reminderInstants('2026-11-02', [1], 1, 'America/New_York')).toHaveLength(1);
  });

  it('TC-503 maths: 7, 3 and 1 day before at 9 AM Chicago, earliest first, no repeats', () => {
    const r = reminderInstants('2026-12-20', [1, 7, 3, 3], 9, 'America/Chicago');
    expect(r.map((x) => [x.daysBefore, x.at.toISOString()])).toEqual([
      [7, '2026-12-13T15:00:00.000Z'],
      [3, '2026-12-17T15:00:00.000Z'],
      [1, '2026-12-19T15:00:00.000Z'],
    ]);
  });

  it('counts days left in the user time zone', () => {
    // 2026-12-01 03:00 UTC is still November 30 in Los Angeles.
    const now = new Date('2026-12-01T03:00:00Z');
    expect(daysUntil('2026-12-01', 'America/Los_Angeles', now)).toBe(1);
    expect(daysUntil('2026-12-01', 'America/New_York', now)).toBe(1);
    expect(daysUntil('2026-12-01', 'UTC', now)).toBe(0);
    expect(daysUntil('2026-11-30', 'UTC', now)).toBe(-1);
  });
});

describe('notification payload', () => {
  it('formats the title and body as the spec shows', () => {
    expect(
      reminderText({
        kind: 'return',
        storeName: 'Target',
        daysLeft: 2,
        amountCents: 4820,
        items: ['Kids sneakers', 'bath towels'],
      }),
    ).toEqual({
      title: 'Target return closes in 2 days',
      body: '$48.20 · Kids sneakers, bath towels',
    });
  });

  it('says "1 day", lists at most three items and leaves out empty ones', () => {
    expect(
      reminderText({
        kind: 'return',
        storeName: 'Best Buy',
        daysLeft: 1,
        amountCents: 123456,
        items: ['TV', ' ', 'Mount', 'HDMI cable', 'Remote'],
      }),
    ).toEqual({
      title: 'Best Buy return closes in 1 day',
      body: '$1,234.56 · TV, Mount, HDMI cable',
    });
  });

  it('shows only the amount when there are no items, and cuts a long body', () => {
    expect(
      reminderText({ kind: 'return', storeName: 'Costco', daysLeft: 7, amountCents: 5, items: [] })
        .body,
    ).toBe('$0.05');
    const long = reminderText({
      kind: 'return',
      storeName: 'Costco',
      daysLeft: 7,
      amountCents: 100,
      items: ['x'.repeat(200)],
    }).body;
    expect(long).toHaveLength(120);
    expect(long.endsWith('…')).toBe(true);
  });

  it('words warranty reminders and the last day', () => {
    expect(
      reminderText({
        kind: 'warranty',
        storeName: 'Apple',
        daysLeft: 30,
        amountCents: 99900,
        items: ['iPad'],
      }),
    ).toEqual({ title: 'Apple warranty ends in 30 days', body: '$999.00 · iPad' });
    expect(
      reminderText({
        kind: 'return',
        storeName: 'Target',
        daysLeft: 0,
        amountCents: 100,
        items: [],
      }).title,
    ).toBe('Target return closes today');
  });

  it('formats dollars with thousands separators', () => {
    expect(formatUsd(9999999)).toBe('$99,999.99');
    expect(formatUsd(100)).toBe('$1.00');
  });

  it('sends the receipt id as data, on the Android reminder channel, with sound on iOS', () => {
    const m = reminderMessage(['t1'], 'r123', { title: 'T', body: 'B' });
    expect(m).toEqual({
      tokens: ['t1'],
      notification: { title: 'T', body: 'B' },
      data: { receiptId: 'r123' },
      android: { priority: 'high', notification: { channelId: 'return-reminders' } },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  });
});
