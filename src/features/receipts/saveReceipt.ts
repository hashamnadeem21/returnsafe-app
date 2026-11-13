import * as Haptics from 'expo-haptics';

import { createReceipt, saveCustomStore, updateReceipt } from './receiptsRepo';
import type { ReceiptInput } from './types';

function rememberWindow(uid: string, input: ReceiptInput) {
  // Stores that are not in the built-in list keep the window the user chose for next time.
  if (!input.storeId) saveCustomStore(uid, input.storeName, input.returnDays);
}

const success = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

export function addReceipt(uid: string, input: ReceiptInput): string {
  rememberWindow(uid, input);
  const id = createReceipt(uid, input);
  success();
  return id;
}

export function editReceipt(uid: string, id: string, input: ReceiptInput): void {
  rememberWindow(uid, input);
  updateReceipt(uid, id, input);
  success();
}
