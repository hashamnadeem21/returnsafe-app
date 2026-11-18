/** Builds the export file on the device and hands it to the system share sheet. */
import { getDownloadURL, ref } from '@react-native-firebase/storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { localPhoto } from '@/features/scan/photos';
import { queuedPhoto } from '@/features/scan/uploadQueue';
import type { Receipt } from '@/features/receipts/types';
import type { IsoDate } from '@/lib/dates';
import { storage } from '@/lib/firebase';

import { receiptsCsv } from './csv';
import { receiptsHtml } from './pdf';

export type ExportFormat = 'pdf' | 'csv';

function exportDir(): Directory {
  const dir = new Directory(Paths.cache, 'export');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** The photo as a data URI: the copy on this phone if there is one, else from Storage. */
async function photoDataUri(path: string): Promise<string | null> {
  try {
    const photoId =
      path
        .split('/')
        .pop()
        ?.replace(/\.jpg$/, '') ?? '';
    const queued = queuedPhoto(path);
    let file: File | null = queued ? new File(queued.localUri) : null;
    if (!file?.exists && photoId) file = localPhoto(photoId);
    if (!file?.exists) {
      const url = await getDownloadURL(ref(storage(), path));
      const target = new File(exportDir(), `${photoId || 'photo'}.jpg`);
      if (target.exists) target.delete();
      file = await File.downloadFileAsync(url, target);
    }
    return `data:image/jpeg;base64,${await file.base64()}`;
  } catch {
    return null;
  }
}

async function loadPhotos(receipts: readonly Receipt[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  // A few at a time: memory stays low and slow downloads still overlap.
  const paths = receipts.flatMap((r) => r.photoPaths);
  for (let i = 0; i < paths.length; i += 4) {
    const batch = paths.slice(i, i + 4);
    const uris = await Promise.all(batch.map(photoDataUri));
    batch.forEach((p, j) => {
      const uri = uris[j];
      if (uri) out[p] = uri;
    });
  }
  return out;
}

const fileName = (today: IsoDate, ext: string) => `ReturnSafe receipts ${today}.${ext}`;

/** Creates the PDF or CSV and opens the share sheet. */
export async function exportReceipts(
  receipts: readonly Receipt[],
  format: ExportFormat,
  today: IsoDate,
): Promise<void> {
  const target = new File(exportDir(), fileName(today, format));
  if (target.exists) target.delete();
  if (format === 'csv') {
    target.create();
    await target.write(receiptsCsv(receipts, today));
    await Sharing.shareAsync(target.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export receipts',
    });
    return;
  }
  const html = receiptsHtml(receipts, await loadPhotos(receipts), today);
  const { uri } = await Print.printToFileAsync({ html });
  // Give the file a readable name before sharing it.
  const printed = new File(uri);
  await printed.move(target);
  await Sharing.shareAsync(printed.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Export receipts',
  });
}
