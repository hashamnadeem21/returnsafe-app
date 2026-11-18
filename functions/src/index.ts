import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

export { deleteAccount } from './deleteAccount.js';
export { expireReceipts } from './expireReceipts.js';
export { initUser } from './initUser.js';
export { mergeGuestAccount } from './mergeGuestAccount.js';
export { onReceiptWrite } from './onReceiptWrite.js';
export { onUserWrite } from './onUserWrite.js';
export { sendDueReminders } from './sendDueReminders.js';
export { revenueCatWebhook } from './revenueCatWebhook.js';
