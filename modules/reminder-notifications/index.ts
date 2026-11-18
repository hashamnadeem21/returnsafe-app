/**
 * Reminder notifications, native side.
 * - Android: the "return-reminders" channel (high importance), the white notification icon and
 *   its teal tint, and whether notifications are allowed.
 * - iOS: reading and asking for the notification permission.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export type NativePermission = 'granted' | 'denied' | 'undetermined';

type ReminderNotificationsNative = {
  // Android
  ensureChannel?: () => void;
  notificationsEnabled?: () => boolean;
  // iOS
  getPermission?: () => Promise<NativePermission>;
  requestPermission?: () => Promise<NativePermission>;
};

const native = requireOptionalNativeModule<ReminderNotificationsNative>('ReminderNotifications');

export const REMINDER_CHANNEL_ID = 'return-reminders';

/** Android: creates the channel if it is missing (safe to call on every launch). */
export function ensureReminderChannel(): void {
  native?.ensureChannel?.();
}

/** Android: true when the app may show notifications. */
export function androidNotificationsEnabled(): boolean {
  return native?.notificationsEnabled?.() ?? false;
}

/** iOS: the current permission. */
export function getIosPermission(): Promise<NativePermission> {
  return native?.getPermission?.() ?? Promise.resolve('denied');
}

/** iOS: shows the system prompt if it was never shown, then returns the answer. */
export function requestIosPermission(): Promise<NativePermission> {
  return native?.requestPermission?.() ?? Promise.resolve('denied');
}
