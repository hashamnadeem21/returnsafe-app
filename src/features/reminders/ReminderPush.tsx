/**
 * Push reminders while signed in: keeps the permission state fresh, saves this device's token,
 * and opens the receipt when a reminder is tapped (from a closed app, from the background, or
 * from the in-app message shown while the app is open). Renders nothing.
 */
import {
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSnackbar } from '@/components';
import { useReceipts } from '@/features/receipts/receiptsStore';
import { useSession } from '@/stores/session';

import { ensureReminderChannel } from '../../../modules/reminder-notifications';
import { usePushPermission } from './permission';
import { registerPushToken } from './pushTokens';

/** The launch notification is read once per app start, not again after a sign-out and in. */
let launchHandled = false;

function receiptIdOf(message: RemoteMessage | null): string | null {
  const id = message?.data?.receiptId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Waits until the signed-in user's receipts have loaded. */
function receiptsLoaded(uid: string): Promise<void> {
  return new Promise((resolve) => {
    const ready = () => {
      const s = useReceipts.getState();
      return s.uid === uid && s.loaded;
    };
    if (ready()) return resolve();
    const stop = useReceipts.subscribe(() => {
      if (!ready()) return;
      stop();
      resolve();
    });
  });
}

/** Opens a receipt from a reminder, or Home if the receipt no longer exists. */
export async function openReceiptFromReminder(receiptId: string): Promise<void> {
  const uid = useSession.getState().user?.uid;
  if (!uid) return;
  await receiptsLoaded(uid);
  if (useSession.getState().user?.uid !== uid) return;
  if (useReceipts.getState().receipts.some((r) => r.id === receiptId)) {
    router.push({ pathname: '/receipt/[id]', params: { id: receiptId } });
  } else {
    router.navigate('/home');
  }
}

export function ReminderPush() {
  const uid = useSession((s) => s.user?.uid ?? null);
  const status = usePushPermission((s) => s.status);
  const refresh = usePushPermission((s) => s.refresh);

  // The Android channel must exist before the first reminder arrives.
  useEffect(() => {
    ensureReminderChannel();
  }, []);

  // Read the permission now and each time the app returns (it may have changed in Settings).
  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (!uid || status !== 'granted') return;
    return registerPushToken(uid);
  }, [uid, status]);

  useEffect(() => {
    if (!uid) return;
    const messaging = getMessaging();
    const open = (message: RemoteMessage | null) => {
      const id = receiptIdOf(message);
      if (id) void openReceiptFromReminder(id);
    };
    if (!launchHandled) {
      launchHandled = true;
      getInitialNotification(messaging)
        .then(open)
        .catch(() => undefined);
    }
    const stopOpened = onNotificationOpenedApp(messaging, open);
    // The phone shows no notification while the app is open, so show it in the app instead.
    const stopForeground = onMessage(messaging, async (message) => {
      const id = receiptIdOf(message);
      const title = message.notification?.title;
      if (!id || !title) return;
      useSnackbar.getState().show({
        message: title,
        actionLabel: 'View',
        onAction: () => void openReceiptFromReminder(id),
        durationMs: 8000,
      });
    });
    return () => {
      stopOpened();
      stopForeground();
    };
  }, [uid]);

  return null;
}

/** Test hook: lets the launch notification be handled again. */
export function resetReminderPushForTests(): void {
  launchHandled = false;
}
