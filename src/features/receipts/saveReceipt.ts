import * as Haptics from 'expo-haptics';

import { photoPath } from '@/features/scan/photos';
import { enqueueUpload } from '@/features/scan/uploadQueue';

import { createReceipt, newReceiptId, saveCustomStore, updateReceipt } from './receiptsRepo';
import type { ReceiptInput } from './types';

function rememberWindow(uid: string, input: ReceiptInput) {
  // Stores that are not in the built-in list keep the window the user chose for next time.
  if (!input.storeId) saveCustomStore(uid, input.storeName, input.returnDays);
}

const success = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

/** A scanned photo kept on the device, to attach to the new receipt. */
export type NewPhoto = { photoId: string; localUri: string };

/**
 * Saves a new receipt. A scanned photo's Storage path is written with the receipt straight away
 * (so it works offline) and the file itself joins the upload queue.
 */
export function addReceipt(uid: string, input: ReceiptInput, photo?: NewPhoto): string {
  rememberWindow(uid, input);
  if (!photo) {
    const id = createReceipt(uid, input);
    success();
    return id;
  }
  const id = newReceiptId(uid);
  const path = photoPath(uid, id, photo.photoId);
  createReceipt(uid, input, { id, photoPaths: [path] });
  void enqueueUpload({
    uid,
    receiptId: id,
    photoId: photo.photoId,
    path,
    localUri: photo.localUri,
  });
  success();
  return id;
}

export function editReceipt(uid: string, id: string, input: ReceiptInput): void {
  rememberWindow(uid, input);
  updateReceipt(uid, id, input);
  success();
}
