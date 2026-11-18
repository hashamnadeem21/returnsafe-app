/* global jest */
/**
 * In-memory stand-ins for @react-native-firebase/messaging and modules/reminder-notifications:
 * a push token, notification taps and the notification permission, driven by the tests.
 */
const state = {
  token: 'device-token-1',
  initial: null,
  opened: new Set(),
  foreground: new Set(),
  refresh: new Set(),
  // iOS permission and what the system prompt answers.
  permission: 'undetermined',
  promptAnswer: 'granted',
};

const fakeMessaging = {
  getMessaging: () => ({}),
  getToken: jest.fn(async () => state.token),
  onTokenRefresh: jest.fn((_m, listener) => {
    state.refresh.add(listener);
    return () => state.refresh.delete(listener);
  }),
  getInitialNotification: jest.fn(async () => {
    const m = state.initial;
    state.initial = null;
    return m;
  }),
  onNotificationOpenedApp: jest.fn((_m, listener) => {
    state.opened.add(listener);
    return () => state.opened.delete(listener);
  }),
  onMessage: jest.fn((_m, listener) => {
    state.foreground.add(listener);
    return () => state.foreground.delete(listener);
  }),
};

const fakeReminderNotifications = {
  REMINDER_CHANNEL_ID: 'return-reminders',
  ensureReminderChannel: jest.fn(),
  androidNotificationsEnabled: jest.fn(() => state.permission === 'granted'),
  getIosPermission: jest.fn(async () => state.permission),
  requestIosPermission: jest.fn(async () => {
    if (state.permission === 'undetermined') state.permission = state.promptAnswer;
    return state.permission;
  }),
};

/** A reminder push as FCM delivers it. */
function reminderMessage(receiptId, title = 'Target return closes in 2 days') {
  return { data: { receiptId }, notification: { title, body: '$48.20 · Kids sneakers' } };
}

function tapNotification(message) {
  for (const l of [...state.opened]) l(message);
}

async function receiveInForeground(message) {
  for (const l of [...state.foreground]) await l(message);
}

function resetMessaging() {
  state.token = 'device-token-1';
  state.initial = null;
  state.opened.clear();
  state.foreground.clear();
  state.refresh.clear();
  state.permission = 'undetermined';
  state.promptAnswer = 'granted';
  fakeReminderNotifications.requestIosPermission.mockClear();
}

module.exports = {
  fakeMessaging,
  fakeReminderNotifications,
  messagingState: state,
  reminderMessage,
  tapNotification,
  receiveInForeground,
  resetMessaging,
};
