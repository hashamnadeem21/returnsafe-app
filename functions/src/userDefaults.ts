/** Defaults for a new users/{uid} document. Only the server creates this document. */
export const USER_DEFAULTS = {
  reminderHour: 9,
  // Free users still only get the 1-day reminder; the reminder scheduler enforces that (Phase 5).
  reminderDays: [7, 3, 1],
  activeCount: 0,
  isPro: false,
  proExpiresAt: null,
  freeLimit: 5,
} as const;

export const DEFAULT_TIMEZONE = 'America/New_York';
const MAX_NAME = 80;

/** Returns the IANA zone if the runtime recognises it, otherwise the default. */
export function validTimezone(tz: unknown): string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function cleanName(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined;
  const trimmed = name.trim().slice(0, MAX_NAME);
  return trimmed.length > 0 ? trimmed : undefined;
}
