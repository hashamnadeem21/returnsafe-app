/**
 * Deadline maths. A purchase date and a return deadline are calendar dates ("YYYY-MM-DD") in the
 * user's time zone, so adding days never drifts across daylight-saving changes. Only reminder
 * times become real instants, and those are converted from the user's zone to UTC.
 */
import { format } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import * as Localization from 'expo-localization';

/** A calendar date, "YYYY-MM-DD". */
export type IsoDate = string;

export const DEFAULT_TIMEZONE = 'America/New_York';
const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(date: IsoDate): [number, number, number] {
  const m = ISO_DATE.exec(date);
  if (!m) throw new Error(`Not a calendar date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// Calendar dates are handled as UTC midnights: UTC has no daylight saving, so one day is always 24 h.
function toUtcMs(date: IsoDate): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True for a real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  return fromUtcMs(toUtcMs(value)) === value;
}

export function addCalendarDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function calendarDaysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Last day the item can be returned: the purchase date plus the store's window in calendar days. */
export function computeDeadline(purchaseDate: IsoDate, returnDays: number): IsoDate {
  return addCalendarDays(purchaseDate, returnDays);
}

/** The device's IANA time zone, falling back to New York. */
export function deviceTimezone(): string {
  return Localization.getCalendars()[0]?.timeZone ?? DEFAULT_TIMEZONE;
}

/** Today's calendar date in a time zone. */
export function todayIn(timezone: string, now: Date = new Date()): IsoDate {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

/** Days until the deadline: 0 on the last day, negative once it has passed. */
export function daysLeft(deadline: IsoDate, timezone: string, now: Date = new Date()): number {
  return calendarDaysBetween(todayIn(timezone, now), deadline);
}

/**
 * Reminder times as UTC instants: `reminderHour` o'clock local time, each of `reminderDays` days
 * before the deadline, in time order. On the day clocks spring forward, an hour that does not exist
 * (2 AM) moves to the next real hour.
 */
export function reminderInstants(
  deadline: IsoDate,
  reminderDays: readonly number[],
  reminderHour: number,
  timezone: string,
): Date[] {
  const hour = String(reminderHour).padStart(2, '0');
  return [...new Set(reminderDays)]
    .sort((a, b) => b - a)
    .map((before) => {
      const day = addCalendarDays(deadline, -before);
      let instant = fromZonedTime(`${day}T${hour}:00:00`, timezone);
      // A skipped hour comes back an hour early (1 AM for 2 AM); step forward to the next real hour.
      for (
        let i = 0;
        i < 2 && formatInTimeZone(instant, timezone, 'yyyy-MM-dd HH') < `${day} ${hour}`;
        i++
      ) {
        instant = new Date(instant.getTime() + 60 * 60 * 1000);
      }
      return instant;
    });
}

function localDate(date: IsoDate): Date {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d);
}

/** "Sat, Nov 14" */
export function formatShortDate(date: IsoDate): string {
  return format(localDate(date), 'EEE, MMM d');
}

/** "Sat, Nov 14, 2026" */
export function formatLongDate(date: IsoDate): string {
  return format(localDate(date), 'EEE, MMM d, yyyy');
}

/** "Aug 16, 2026" */
export function formatMediumDate(date: IsoDate): string {
  return format(localDate(date), 'MMM d, yyyy');
}

/** A Date at local midnight for pickers, and back. */
export function isoToPickerDate(date: IsoDate): Date {
  return localDate(date);
}

export function pickerDateToIso(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

/** "2 days", "1 day", "Today", "Expired" */
export function daysLeftLabel(days: number): string {
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  return days === 1 ? '1 day' : `${days} days`;
}
