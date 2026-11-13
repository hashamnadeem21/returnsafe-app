import {
  addCalendarDays,
  computeDeadline,
  daysLeft,
  daysLeftLabel,
  isIsoDate,
  reminderInstants,
  todayIn,
} from '@/lib/dates';

const iso = (dates: Date[]) => dates.map((d) => d.toISOString());
const at9 = (deadline: string, tz: string, before = 1) =>
  iso(reminderInstants(deadline, [before], 9, tz))[0];

describe('computeDeadline (calendar days)', () => {
  it('TC-301: 2026-01-31 + 90 days is 2026-05-01', () => {
    expect(computeDeadline('2026-01-31', 90)).toBe('2026-05-01');
  });

  it('TC-302: 2028-02-01 + 30 days is 2028-03-02 (leap year)', () => {
    expect(computeDeadline('2028-02-01', 30)).toBe('2028-03-02');
  });

  it.each([
    ['2026-01-31', 30, '2026-03-02'], // through a 28-day February
    ['2028-01-31', 30, '2028-03-01'], // through a 29-day February
    ['2026-08-31', 30, '2026-09-30'], // 31-day month into a 30-day month
    ['2026-12-31', 1, '2027-01-01'], // year end
    ['2028-02-28', 1, '2028-02-29'], // into Feb 29
    ['2027-02-28', 1, '2027-03-01'], // no Feb 29 in 2027
    ['2028-02-29', 365, '2029-02-28'], // bought on Feb 29
    ['2026-03-07', 2, '2026-03-09'], // across the spring-forward night
    ['2026-10-31', 2, '2026-11-02'], // across the fall-back night
    ['2026-11-12', 0, '2026-11-12'],
  ])('%s + %i days is %s', (purchase, days, expected) => {
    expect(computeDeadline(purchase, days)).toBe(expected);
  });

  it('counts backwards too', () => {
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('accepts only real calendar dates', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-1-5')).toBe(false);
    expect(isIsoDate(20260105)).toBe(false);
  });
});

describe('reminderInstants (9 AM local, one day before)', () => {
  it('TC-303: New York on 2026-03-08, the day daylight saving starts, is 13:00 UTC', () => {
    expect(at9('2026-03-09', 'America/New_York')).toBe('2026-03-08T13:00:00.000Z');
  });

  it.each([
    // [zone, reminder day, UTC]
    ['America/New_York', '2026-03-07', '2026-03-07T14:00:00.000Z'], // still EST
    ['America/New_York', '2026-10-31', '2026-10-31T13:00:00.000Z'], // still EDT
    ['America/New_York', '2026-11-01', '2026-11-01T14:00:00.000Z'], // fall back: EST
    ['America/Chicago', '2026-03-08', '2026-03-08T14:00:00.000Z'],
    ['America/Chicago', '2026-11-01', '2026-11-01T15:00:00.000Z'],
    ['America/Denver', '2026-03-08', '2026-03-08T15:00:00.000Z'],
    ['America/Denver', '2026-11-01', '2026-11-01T16:00:00.000Z'],
    ['America/Los_Angeles', '2026-03-08', '2026-03-08T16:00:00.000Z'],
    ['America/Los_Angeles', '2026-11-01', '2026-11-01T17:00:00.000Z'],
    ['America/Phoenix', '2026-03-08', '2026-03-08T16:00:00.000Z'], // no daylight saving
    ['America/Phoenix', '2026-11-01', '2026-11-01T16:00:00.000Z'],
    ['Pacific/Honolulu', '2026-03-08', '2026-03-08T19:00:00.000Z'], // no daylight saving
    ['Pacific/Honolulu', '2026-11-01', '2026-11-01T19:00:00.000Z'],
  ])('%s on %s is %s', (tz, day, expected) => {
    expect(at9(addCalendarDays(day, 1), tz)).toBe(expected);
  });

  it('moves a 2 AM reminder on the spring-forward day to 3 AM, not 1 AM', () => {
    expect(iso(reminderInstants('2026-03-09', [1], 2, 'America/New_York'))).toEqual([
      '2026-03-08T07:00:00.000Z',
    ]);
    expect(iso(reminderInstants('2026-03-09', [1], 2, 'America/Los_Angeles'))).toEqual([
      '2026-03-08T10:00:00.000Z',
    ]);
  });

  it('fires once at 1 AM on the fall-back night', () => {
    expect(iso(reminderInstants('2026-11-02', [1], 1, 'America/New_York'))).toHaveLength(1);
  });

  it('returns 7, 3 and 1 days before in time order, without duplicates', () => {
    expect(iso(reminderInstants('2026-11-14', [1, 7, 3, 3], 9, 'America/Chicago'))).toEqual([
      '2026-11-07T15:00:00.000Z',
      '2026-11-11T15:00:00.000Z',
      '2026-11-13T15:00:00.000Z',
    ]);
  });
});

describe('daysLeft (today in the user time zone)', () => {
  it('uses the local calendar day, not the UTC one', () => {
    const now = new Date('2026-03-10T03:30:00Z'); // 11:30 PM on Mar 9 in New York
    expect(todayIn('America/New_York', now)).toBe('2026-03-09');
    expect(daysLeft('2026-03-10', 'America/New_York', now)).toBe(1);
    expect(daysLeft('2026-03-10', 'UTC', now)).toBe(0);
  });

  it('is late-night correct in Honolulu', () => {
    const now = new Date('2026-11-14T09:00:00Z'); // 11 PM on Nov 13 in Honolulu
    expect(daysLeft('2026-11-14', 'Pacific/Honolulu', now)).toBe(1);
  });

  it('counts 90 for a deadline 90 days out and goes negative once passed', () => {
    const now = new Date('2026-11-12T15:00:00Z');
    expect(daysLeft(computeDeadline('2026-11-12', 90), 'America/New_York', now)).toBe(90);
    expect(daysLeft('2026-11-11', 'America/New_York', now)).toBe(-1);
  });

  it('labels days left', () => {
    expect(daysLeftLabel(2)).toBe('2 days');
    expect(daysLeftLabel(1)).toBe('1 day');
    expect(daysLeftLabel(0)).toBe('Today');
    expect(daysLeftLabel(-3)).toBe('Expired');
  });
});
