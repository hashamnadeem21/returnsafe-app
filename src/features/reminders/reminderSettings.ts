/** Reminder settings on users/{uid} (S17), and which reminders a receipt gets from them. */
import { doc, serverTimestamp, updateDoc } from '@react-native-firebase/firestore';

import type { UserProfile } from '@/features/receipts/types';
import { db } from '@/lib/firebase';

export type ReminderSettingsPatch = Partial<
  Pick<UserProfile, 'remindersEnabled' | 'reminderHour' | 'reminderDays'>
>;

/** The days-before choices on S17. Free users get only the last one. */
export const REMINDER_DAY_CHOICES = [7, 3, 1] as const;
export const FREE_REMINDER_DAYS = [1];

/**
 * Saves reminder settings. Not awaited by the screens: offline, the change shows at once from
 * the local cache and syncs later. The server rebuilds the reminder rows when it arrives.
 */
export function saveReminderSettings(
  uid: string,
  patch: ReminderSettingsPatch,
  onError: (e: unknown) => void = () => undefined,
): void {
  updateDoc(doc(db(), 'users', uid), { ...patch, updatedAt: serverTimestamp() }).catch(onError);
}

/** Days before the deadline that return reminders fire, as the server schedules them. */
export function effectiveReminderDays(profile: UserProfile | null): number[] {
  if (!profile) return FREE_REMINDER_DAYS;
  if (!profile.remindersEnabled) return [];
  return profile.isPro ? profile.reminderDays : FREE_REMINDER_DAYS;
}

/** "9:00 AM" */
export function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${hour < 12 ? 'AM' : 'PM'}`;
}
