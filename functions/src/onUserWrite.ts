import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { rebuildUserReminders } from './reminders/rebuild.js';

/** User fields that change which reminder rows the user's receipts get. */
const REMINDER_FIELDS = [
  'isPro',
  'remindersEnabled',
  'reminderDays',
  'reminderHour',
  'timezone',
] as const;

/** Rebuilds a user's reminder rows when their plan or reminder settings change. */
export const onUserWrite = onDocumentWritten('users/{uid}', async (event) => {
  const before = event.data?.before;
  const after = event.data?.after;
  // A new user has no receipts yet, and a deleted user's rows go with their receipts.
  if (!before?.exists || !after?.exists) return;
  const changed = REMINDER_FIELDS.some(
    (f) => JSON.stringify(before.get(f) ?? null) !== JSON.stringify(after.get(f) ?? null),
  );
  if (changed) await rebuildUserReminders(event.params.uid);
});
