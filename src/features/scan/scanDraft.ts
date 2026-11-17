/**
 * The scanned receipt waiting on the review screen: its compressed photo and what the parser read.
 * Kept in memory only; the review screen clears it once the receipt is saved or the user leaves.
 */
import { create } from 'zustand';

import type { IsoDate } from '@/lib/dates';

import { recognizeText } from '../../../modules/receipt-text';

import { textFromLines } from './ocrLayout';
import { isReadable, parseReceipt, type ParsedReceipt } from './parseReceipt';
import { newPhotoId, preparePhoto } from './photos';

export type ScanDraft = {
  photoId: string;
  /** The compressed photo kept on the device. */
  photoUri: string;
  parsed: ParsedReceipt;
  /** False when nothing useful was read ("We couldn't read this receipt"). */
  readable: boolean;
};

type ScanDraftState = {
  draft: ScanDraft | null;
  set: (draft: ScanDraft) => void;
  clear: () => void;
};

export const useScanDraft = create<ScanDraftState>((set) => ({
  draft: null,
  set: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
}));

const EMPTY: ParsedReceipt = {
  storeId: null,
  storeName: null,
  purchaseDate: null,
  amountCents: null,
  items: [],
};

/**
 * Compresses the scanned image, reads its text and parses it. Reading failures are not errors:
 * the photo is still kept and the user fills in the form by hand.
 */
export async function draftFromImage(imageUri: string, today: IsoDate): Promise<ScanDraft> {
  const photoId = newPhotoId();
  const photoUri = await preparePhoto(imageUri, photoId);
  let parsed = EMPTY;
  try {
    parsed = parseReceipt(textFromLines(await recognizeText(photoUri)), today);
  } catch {
    // Text recognition unavailable or failed: same as a receipt with nothing readable.
  }
  return { photoId, photoUri, parsed, readable: isReadable(parsed) };
}
