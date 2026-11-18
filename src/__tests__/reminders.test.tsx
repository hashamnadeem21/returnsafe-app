import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import { useSnackbar } from '@/components/Snackbar';
import { signOut } from '@/features/auth/authService';
import { useReceipts } from '@/features/receipts/receiptsStore';
import type { UserProfile } from '@/features/receipts/types';
import { usePushPermission } from '@/features/reminders/permission';
import { resetReminderPushForTests } from '@/features/reminders/ReminderPush';
import { effectiveReminderDays, formatHour } from '@/features/reminders/reminderSettings';
import { addCalendarDays, todayIn } from '@/lib/dates';
import { INSTALL_KEY } from '@/lib/install';
import { ONBOARDING_KEY } from '@/lib/onboarding';
import { useSession } from '@/stores/session';
import {
  firestoreDocs,
  firestoreWrites,
  reset,
  resetFirestore,
  seedDoc,
  signInAnonymously,
} from '@/test/firebase';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const push = require('@/test/fakeMessaging') as {
  messagingState: { permission: string; promptAnswer: string; initial: unknown; token: string };
  reminderMessage: (id: string, title?: string) => unknown;
  tapNotification: (m: unknown) => void;
  receiveInForeground: (m: unknown) => Promise<void>;
  resetMessaging: () => void;
};

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true, null],
  Inter_400Regular: 1,
  Inter_500Medium: 1,
  Inter_600SemiBold: 1,
  Inter_700Bold: 1,
  Inter_800ExtraBold: 1,
}));

const APP_DIR = 'src/app';
const TZ = 'America/New_York';
let uid = '';

/** Runs `fn`, then lets the async work it started (loading receipts, navigating) finish. */
async function settle(fn: () => void = () => undefined) {
  await act(async () => {
    fn();
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

const userPath = () => `users/${uid}`;
const user = () => firestoreDocs.get(userPath()) as Record<string, unknown>;

function receiptDoc(store = 'Target') {
  const purchaseDate = addCalendarDays(todayIn(TZ), -10);
  return {
    storeId: null,
    storeName: store,
    purchaseDate,
    amountCents: 4820,
    items: [],
    returnDays: 90,
    returnDeadline: addCalendarDays(purchaseDate, 90),
    warrantyMonths: null,
    warrantyEnd: null,
    status: 'active',
    photoPaths: [],
    ocrText: null,
    statusChangedAt: null,
    createdAt: { toMillis: () => 1 },
  };
}

async function start(
  url: string,
  profile: Record<string, unknown> = {},
  receipts: string[] = [],
  showPrimer = false,
) {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  const { user: u } = (await signInAnonymously()) as { user: { uid: string } };
  uid = u.uid;
  seedDoc(userPath(), {
    isPro: false,
    activeCount: receipts.length,
    freeLimit: 5,
    reminderHour: 9,
    reminderDays: [7, 3, 1],
    timezone: TZ,
    fcmTokens: [],
    ...profile,
  });
  for (const id of receipts) seedDoc(`${userPath()}/receipts/${id}`, receiptDoc());
  useSession.setState({ showPrimer });
  await renderRouter(APP_DIR, { initialUrl: url });
}

beforeEach(async () => {
  reset();
  resetFirestore();
  push.resetMessaging();
  resetReminderPushForTests();
  useSession.setState({ ready: false, user: null, showPrimer: false });
  useReceipts.getState().reset(null);
  usePushPermission.setState({ status: null });
  useSnackbar.setState({ current: null });
  await AsyncStorage.clear();
  await AsyncStorage.setItem(INSTALL_KEY, '1');
});

describe('notification primer (S07)', () => {
  it('TC-501: Turn on shows the system prompt, then saves the push token on the user doc', async () => {
    await start('/notification-primer', {}, [], true);
    await fireEvent.press(await screen.findByTestId('primer-enable'));
    expect(await screen.findByTestId('screen-home')).toBeTruthy();
    await waitFor(() => expect(user().fcmTokens).toEqual(['device-token-1']));
    expect(screen.queryByTestId('home-reminders-off')).toBeNull();
  });

  it('TC-502: Don\'t allow leaves Home showing "Reminders are off" with Turn on', async () => {
    push.messagingState.promptAnswer = 'denied';
    await start('/notification-primer', {}, [], true);
    await fireEvent.press(await screen.findByTestId('primer-enable'));
    const banner = await screen.findByTestId('home-reminders-off');
    expect(banner).toHaveTextContent(/Reminders are off\..*Turn on/);
    expect(user().fcmTokens).toEqual([]);
  });

  it('Not now never asks, and Home shows the banner', async () => {
    await start('/notification-primer', {}, [], true);
    await fireEvent.press(await screen.findByTestId('primer-skip'));
    expect(await screen.findByTestId('home-reminders-off')).toBeTruthy();
    expect(push.messagingState.permission).toBe('undetermined');
  });
});

describe('Home banner', () => {
  it('Turn on asks first, then saves the token and hides the banner', async () => {
    await start('/home');
    await fireEvent.press(await screen.findByTestId('home-reminders-off'));
    await waitFor(() => expect(screen.queryByTestId('home-reminders-off')).toBeNull());
    await waitFor(() => expect(user().fcmTokens).toEqual(['device-token-1']));
  });

  it('opens the phone settings once notifications were refused', async () => {
    push.messagingState.permission = 'denied';
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await start('/home');
    await fireEvent.press(await screen.findByTestId('home-reminders-off'));
    await waitFor(() => expect(open).toHaveBeenCalled());
    open.mockRestore();
  });

  it('shows when return reminders are switched off, and Turn on switches them back on', async () => {
    push.messagingState.permission = 'granted';
    await start('/home', { remindersEnabled: false });
    await fireEvent.press(await screen.findByTestId('home-reminders-off'));
    await waitFor(() => expect(user().remindersEnabled).toBe(true));
    await waitFor(() => expect(screen.queryByTestId('home-reminders-off')).toBeNull());
  });

  it('is hidden when notifications are allowed and reminders are on', async () => {
    push.messagingState.permission = 'granted';
    await start('/home');
    await screen.findByTestId('screen-home-title');
    await waitFor(() => expect(user().fcmTokens).toEqual(['device-token-1']));
    expect(screen.queryByTestId('home-reminders-off')).toBeNull();
  });
});

describe('reminder settings (S17)', () => {
  it('switches return reminders off and sets the time of day', async () => {
    push.messagingState.permission = 'granted';
    await start('/settings/reminders');
    await fireEvent(await screen.findByTestId('reminders-toggle'), 'valueChange', false);
    await waitFor(() => expect(user().remindersEnabled).toBe(false));

    expect(screen.getByTestId('reminders-time')).toHaveTextContent(/9:00 AM/);
    await fireEvent.press(screen.getByTestId('reminders-time'));
    await fireEvent.press(await screen.findByTestId('reminder-hour-18'));
    await waitFor(() => expect(user().reminderHour).toBe(18));
    expect(await screen.findByTestId('reminders-time')).toHaveTextContent(/6:00 PM/);
    expect(screen.getByTestId('reminders-permission')).toHaveTextContent(/Notifications allowed/);
  });

  it('locks 7 and 3 days before for Free users and opens the paywall', async () => {
    await start('/settings/reminders');
    expect(await screen.findByText('Pro adds reminders 7 and 3 days before.')).toBeTruthy();
    expect(screen.getByTestId('reminder-day-1')).toHaveProp('accessibilityState', {
      selected: true,
    });
    await fireEvent.press(screen.getByTestId('reminder-day-7'));
    expect(await screen.findByTestId('screen-paywall')).toBeTruthy();
    expect(user().reminderDays).toEqual([7, 3, 1]);
  });

  it('lets Pro users choose the days, keeping at least one', async () => {
    await start('/settings/reminders', { isPro: true });
    await fireEvent.press(await screen.findByTestId('reminder-day-3'));
    await waitFor(() => expect(user().reminderDays).toEqual([7, 1]));
    await fireEvent.press(screen.getByTestId('reminder-day-7'));
    await waitFor(() => expect(user().reminderDays).toEqual([1]));
    const writes = firestoreWrites.length;
    await fireEvent.press(screen.getByTestId('reminder-day-1'));
    expect(firestoreWrites.length).toBe(writes);
    expect(user().reminderDays).toEqual([1]);
    expect(screen.queryByText('Pro adds reminders 7 and 3 days before.')).toBeNull();
  });

  it('shows warranty reminders as Pro, and the phone permission with a way to fix it', async () => {
    push.messagingState.permission = 'denied';
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await start('/settings/reminders');
    expect(await screen.findByLabelText(/Warranty reminders.*Pro feature/)).toBeTruthy();
    expect(await screen.findByTestId('reminders-permission')).toHaveTextContent(
      /Notifications are off/,
    );
    await fireEvent.press(screen.getByTestId('reminders-permission'));
    await waitFor(() => expect(open).toHaveBeenCalled());
    open.mockRestore();
    await fireEvent.press(screen.getByTestId('reminders-warranty'));
    expect(await screen.findByTestId('screen-paywall')).toBeTruthy();
  });
});

describe('opening a reminder', () => {
  it('a tap from the background opens that receipt', async () => {
    await start('/home', {}, ['r1']);
    await screen.findByTestId('screen-home-title');
    await settle(() => push.tapNotification(push.reminderMessage('r1')));
    expect(await screen.findByTestId('screen-receipt-detail')).toHaveTextContent(/Target/);
  });

  it('TC-505 (closed app): the launch notification opens the receipt once loaded', async () => {
    push.messagingState.initial = push.reminderMessage('r1');
    await start('/home', {}, ['r1']);
    await settle();
    expect(await screen.findByTestId('screen-receipt-detail')).toHaveTextContent(/Target/);
  });

  it('falls back to Home when the receipt no longer exists', async () => {
    await start('/settings/reminders', {}, ['r1']);
    await screen.findByTestId('screen-settings-reminders');
    await settle(() => push.tapNotification(push.reminderMessage('gone')));
    expect(await screen.findByTestId('screen-home')).toBeTruthy();
  });

  it('while the app is open, shows the reminder in the app with View', async () => {
    await start('/home', {}, ['r1']);
    await screen.findByTestId('screen-home-title');
    await act(() => push.receiveInForeground(push.reminderMessage('r1')));
    expect(useSnackbar.getState().current).toMatchObject({
      message: 'Target return closes in 2 days',
      actionLabel: 'View',
    });
    await settle(() => useSnackbar.getState().current?.onAction?.());
    expect(await screen.findByTestId('screen-receipt-detail')).toBeTruthy();
  });
});

describe('push token', () => {
  it('is removed from the user doc on sign-out', async () => {
    push.messagingState.permission = 'granted';
    await start('/home');
    await waitFor(() => expect(user().fcmTokens).toEqual(['device-token-1']));
    const path = userPath();
    await act(() => signOut());
    expect((firestoreDocs.get(path) as Record<string, unknown>).fcmTokens).toEqual([]);
  });
});

describe('reminder helpers', () => {
  const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
    isPro: false,
    activeCount: 0,
    freeLimit: 5,
    remindersEnabled: true,
    reminderHour: 9,
    reminderDays: [7, 3, 1],
    timezone: TZ,
    ...over,
  });

  it('Free users get the day before, Pro their days, nobody when switched off', () => {
    expect(effectiveReminderDays(profile())).toEqual([1]);
    expect(effectiveReminderDays(profile({ isPro: true }))).toEqual([7, 3, 1]);
    expect(effectiveReminderDays(profile({ isPro: true, remindersEnabled: false }))).toEqual([]);
    expect(effectiveReminderDays(null)).toEqual([1]);
  });

  it('formats the hour', () => {
    expect([0, 9, 12, 18, 23].map(formatHour)).toEqual([
      '12:00 AM',
      '9:00 AM',
      '12:00 PM',
      '6:00 PM',
      '11:00 PM',
    ]);
  });
});
