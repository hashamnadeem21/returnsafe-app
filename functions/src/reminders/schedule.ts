/**
 * When reminders fire. Deadlines are calendar dates ("YYYY-MM-DD") in the user's time zone; a
 * reminder is `reminderHour` o'clock local time, a number of days before that date, turned into a
 * UTC instant. The same maths runs in the app (src/lib/dates.ts) to show the next reminder.
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Free users get one return reminder, the day before. */
export const FREE_REMINDER_DAYS: readonly number[] = [1];
export const DEFAULT_REMINDER_DAYS: readonly number[] = [7, 3, 1];
export const DEFAULT_REMINDER_HOUR = 9;
/** Pro warranty reminders fire this many days before coverage ends. */
export const WARRANTY_DAYS_BEFORE = 30;

function toUtcMs(date: string): number {
  const m = ISO_DATE.exec(date);
  if (!m) throw new Error(`Not a calendar date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  return new Date(toUtcMs(value)).toISOString().slice(0, 10) === value;
}

export function addCalendarDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Today's calendar date in a time zone. */
export function todayIn(timezone: string, now: Date): string {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

/** Whole days from today (in the zone) to `date`: 0 on the day itself, negative after it. */
export function daysUntil(date: string, timezone: string, now: Date): number {
  return Math.round((toUtcMs(date) - toUtcMs(todayIn(timezone, now))) / DAY_MS);
}

/**
 * `hour` o'clock local time on `day` as a UTC instant. On the day clocks spring forward, an hour
 * that does not exist (2 AM) moves to the next real hour.
 */
export function localHourToUtc(day: string, hour: number, timezone: string): Date {
  const hh = String(hour).padStart(2, '0');
  let instant = fromZonedTime(`${day}T${hh}:00:00`, timezone);
  // A skipped hour comes back an hour early (1 AM for 2 AM); step forward to the next real hour.
  for (
    let i = 0;
    i < 2 && formatInTimeZone(instant, timezone, 'yyyy-MM-dd HH') < `${day} ${hh}`;
    i++
  ) {
    instant = new Date(instant.getTime() + 60 * 60 * 1000);
  }
  return instant;
}

/** Each of `daysBefore` days before `date` at `hour` local time, earliest first. */
export function reminderInstants(
  date: string,
  daysBefore: readonly number[],
  hour: number,
  timezone: string,
): { daysBefore: number; at: Date }[] {
  return [...new Set(daysBefore)]
    .sort((a, b) => b - a)
    .map((before) => ({
      daysBefore: before,
      at: localHourToUtc(addCalendarDays(date, -before), hour, timezone),
    }));
}

/** The user's reminder days, cleaned: whole numbers from 1 to 30, at most three. */
export function cleanReminderDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [...DEFAULT_REMINDER_DAYS];
  return [...new Set(value)]
    .filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 30)
    .slice(0, 3);
}

export function cleanReminderHour(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23
    ? value
    : DEFAULT_REMINDER_HOUR;
}
