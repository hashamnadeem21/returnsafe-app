/**
 * Receipt photos on the device: compressed once after scanning and kept in the app's documents
 * folder until the upload finishes, so an offline save survives an app restart.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Longest side of an uploaded photo, in pixels. */
export const MAX_PHOTO_SIDE = 2000;
export const PHOTO_QUALITY = 0.8;

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** A random id chosen once per photo, so every retry uploads to the same file. */
export function newPhotoId(random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 20; i++) id += ID_CHARS[Math.floor(random() * ID_CHARS.length)];
  return id;
}

/** Storage path of a receipt photo (matches storage.rules). */
export function photoPath(uid: string, receiptId: string, photoId: string): string {
  return `users/${uid}/receipts/${receiptId}/${photoId}.jpg`;
}

function photoDir(): Directory {
  const dir = new Directory(Paths.document, 'receipt-photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** The kept copy of a photo, if it is still on this device. */
export function localPhoto(photoId: string): File {
  return new File(photoDir(), `${photoId}.jpg`);
}

/**
 * Shrinks the scan to at most 2000 px on its longest side as an ~80% JPEG and keeps it as
 * receipt-photos/{photoId}.jpg. Returns the kept file's URI.
 */
export async function preparePhoto(sourceUri: string, photoId: string): Promise<string> {
  const original = await ImageManipulator.manipulate(sourceUri).renderAsync();
  const longest = Math.max(original.width, original.height);
  const image =
    longest > MAX_PHOTO_SIDE
      ? await ImageManipulator.manipulate(sourceUri)
          .resize(
            original.width >= original.height
              ? { width: MAX_PHOTO_SIDE }
              : { height: MAX_PHOTO_SIDE },
          )
          .renderAsync()
      : original;
  const saved = await image.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
  const target = localPhoto(photoId);
  if (target.exists) target.delete();
  // move runs natively in the background; wait for it so the file is there when this returns.
  await new File(saved.uri).move(target);
  return target.uri;
}

/** Removes the kept copy once it is uploaded (or its receipt is deleted). */
export function forgetLocalPhoto(photoId: string): void {
  try {
    const file = localPhoto(photoId);
    if (file.exists) file.delete();
  } catch {
    // Nothing to clean up.
  }
}
