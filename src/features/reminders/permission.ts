/**
 * Notification permission for reminders.
 * - iOS: the system prompt, asked through modules/reminder-notifications.
 * - Android 13+: the POST_NOTIFICATIONS runtime permission. Older Android versions allow
 *   notifications unless the user turned them off in Settings.
 * The prompt is only ever shown after the notification primer or a "Turn on" tap.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { create } from 'zustand';

import {
  androidNotificationsEnabled,
  getIosPermission,
  requestIosPermission,
} from '../../../modules/reminder-notifications';

/** "undetermined": the system prompt can still be shown. */
export type PushPermission = 'granted' | 'denied' | 'undetermined';

/** Android: set once the prompt was shown, and once Android stops showing it ("blocked"). */
export const ASKED_KEY = 'returnsafe.pushAsked';
export const BLOCKED_KEY = 'returnsafe.pushBlocked';

const needsRuntimePermission = () => Platform.OS === 'android' && Number(Platform.Version) >= 33;

async function flag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

async function setFlag(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, '1');
  } catch {
    // Only decides whether the next "Turn on" shows the prompt or opens Settings.
  }
}

export async function getPushPermission(): Promise<PushPermission> {
  if (Platform.OS === 'ios') return getIosPermission();
  if (androidNotificationsEnabled()) return 'granted';
  if (needsRuntimePermission() && !(await flag(ASKED_KEY))) return 'undetermined';
  return 'denied';
}

/** Shows the system prompt where it can still be shown, then returns the permission. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (Platform.OS === 'ios') return requestIosPermission();
  if (needsRuntimePermission()) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    await setFlag(ASKED_KEY);
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) await setFlag(BLOCKED_KEY);
  }
  return getPushPermission();
}

/**
 * "Turn on": shows the system prompt if it can still appear; otherwise opens the app's page in
 * the phone's Settings, the only place left to allow notifications.
 */
export async function turnOnPush(): Promise<PushPermission> {
  const now = await getPushPermission();
  if (now === 'granted') return now;
  if (now === 'undetermined') return requestPushPermission();
  // Android shows the prompt again after one "Don't allow", until it is blocked. If the
  // permission is granted but notifications are switched off, only Settings can fix it.
  if (needsRuntimePermission() && !(await flag(BLOCKED_KEY))) {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (!granted) return requestPushPermission();
  }
  await Linking.openSettings();
  return now;
}

type PermissionState = {
  /** Null until it has been read once. */
  status: PushPermission | null;
  refresh: () => Promise<PushPermission>;
  set: (status: PushPermission) => void;
};

/** The current permission, read at launch and whenever the app comes back to the foreground. */
export const usePushPermission = create<PermissionState>((set) => ({
  status: null,
  refresh: async () => {
    const status = await getPushPermission();
    set({ status });
    return status;
  },
  set: (status) => set({ status }),
}));
