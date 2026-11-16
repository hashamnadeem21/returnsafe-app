/**
 * Firestore reads and writes for receipts. Writes are not awaited: with offline persistence the
 * local cache updates at once and the promise only settles when the server answers, which never
 * happens offline. Failures are reported through `onWriteError`.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';

import { cancelUploads } from '@/features/scan/uploadQueue';
import { computeDeadline, DEFAULT_TIMEZONE } from '@/lib/dates';
import { db } from '@/lib/firebase';

import { customStoreId } from './stores';
import type { CustomStore, Receipt, ReceiptInput, ReceiptStatus, UserProfile } from './types';

type Unsubscribe = () => void;
type Data = Record<string, unknown>;

let writeErrorHandler: (e: unknown) => void = () => undefined;
/** Where failed background writes (for example a rule rejection after reconnecting) are reported. */
export function onWriteError(handler: (e: unknown) => void): void {
  writeErrorHandler = handler;
}
function background(p: Promise<unknown>): void {
  p.catch((e: unknown) => writeErrorHandler(e));
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback);
const millis = (v: unknown): number | null =>
  v && typeof v === 'object' && 'toMillis' in v && typeof v.toMillis === 'function'
    ? (v.toMillis as () => number)()
    : null;

function toReceipt(id: string, d: Data, pending: boolean): Receipt {
  const status = str(d.status, 'active');
  return {
    id,
    storeId: typeof d.storeId === 'string' ? d.storeId : null,
    storeName: str(d.storeName, 'Store'),
    purchaseDate: str(d.purchaseDate),
    amountCents: num(d.amountCents),
    items: Array.isArray(d.items) ? d.items.filter((i): i is string => typeof i === 'string') : [],
    returnDays: num(d.returnDays),
    returnDeadline: str(d.returnDeadline),
    warrantyMonths: typeof d.warrantyMonths === 'number' ? d.warrantyMonths : null,
    warrantyEnd: typeof d.warrantyEnd === 'string' ? d.warrantyEnd : null,
    status: (['active', 'returned', 'kept', 'expired'].includes(status)
      ? status
      : 'active') as ReceiptStatus,
    photoPaths: Array.isArray(d.photoPaths)
      ? d.photoPaths.filter((p): p is string => typeof p === 'string')
      : [],
    createdAt: millis(d.createdAt),
    statusChangedAt: millis(d.statusChangedAt),
    pending,
  };
}

const receiptsCol = (uid: string) => collection(db(), 'users', uid, 'receipts');

export function subscribeReceipts(
  uid: string,
  next: (receipts: Receipt[]) => void,
  error: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(receiptsCol(uid), orderBy('returnDeadline', 'asc')),
    { includeMetadataChanges: true },
    (snap) => {
      next(snap.docs.map((d) => toReceipt(d.id, d.data() as Data, d.metadata.hasPendingWrites)));
    },
    error,
  );
}

/**
 * Listens to users/{uid}. `missing` is called when the server confirms the document does not exist
 * (its creation at sign-in failed), so the caller can create it again.
 */
export function subscribeProfile(
  uid: string,
  next: (profile: UserProfile | null) => void,
  error: (e: unknown) => void,
  missing?: () => void,
): Unsubscribe {
  return onSnapshot(
    doc(db(), 'users', uid),
    (snap) => {
      const d = snap.data() as Data | undefined;
      if (!d) {
        if (!snap.metadata.fromCache) missing?.();
        return next(null);
      }
      next({
        isPro: d.isPro === true,
        activeCount: num(d.activeCount),
        freeLimit: num(d.freeLimit, 5),
        reminderHour: num(d.reminderHour, 9),
        reminderDays: Array.isArray(d.reminderDays)
          ? d.reminderDays.filter((x): x is number => typeof x === 'number')
          : [7, 3, 1],
        timezone: str(d.timezone, DEFAULT_TIMEZONE),
      });
    },
    error,
  );
}

export function subscribeCustomStores(
  uid: string,
  next: (stores: CustomStore[]) => void,
  error: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db(), 'users', uid, 'customStores'),
    (snap) => {
      next(
        snap.docs.map((d) => {
          const data = d.data() as Data;
          return { id: d.id, name: str(data.name), returnDays: num(data.returnDays, 30) };
        }),
      );
    },
    error,
  );
}

function fields(input: ReceiptInput): Data {
  return {
    storeId: input.storeId,
    storeName: input.storeName,
    purchaseDate: input.purchaseDate,
    amountCents: input.amountCents,
    items: input.items,
    returnDays: input.returnDays,
    returnDeadline: computeDeadline(input.purchaseDate, input.returnDays),
    updatedAt: serverTimestamp(),
  };
}

/** A new receipt id, made on the device (so a photo path can name it before saving). */
export function newReceiptId(uid: string): string {
  return doc(receiptsCol(uid)).id;
}

/** Saves a new active receipt and returns its id straight away (works offline). */
export function createReceipt(
  uid: string,
  input: ReceiptInput,
  opts: { id?: string; photoPaths?: string[] } = {},
): string {
  const ref = opts.id ? doc(receiptsCol(uid), opts.id) : doc(receiptsCol(uid));
  background(
    setDoc(ref, {
      ...fields(input),
      warrantyMonths: null,
      warrantyEnd: null,
      status: 'active',
      photoPaths: opts.photoPaths ?? [],
      ocrText: null,
      statusChangedAt: null,
      createdAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

export function updateReceipt(uid: string, id: string, input: ReceiptInput): void {
  background(updateDoc(doc(receiptsCol(uid), id), fields(input)));
}

export function setReceiptStatus(uid: string, id: string, status: ReceiptStatus): void {
  background(
    updateDoc(doc(receiptsCol(uid), id), {
      status,
      statusChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
}

/** Deletes the receipt and its photos (files still waiting to upload are dropped too). */
export function deleteReceipt(uid: string, id: string, photoPaths: readonly string[] = []): void {
  background(deleteDoc(doc(receiptsCol(uid), id)));
  // Waiting uploads are dropped; the photos are deleted from Storage, retried until it works.
  void cancelUploads(id, uid, photoPaths);
}

/** Remembers the window chosen for a store that is not in the built-in list. */
export function saveCustomStore(uid: string, name: string, returnDays: number): void {
  background(
    setDoc(doc(db(), 'users', uid, 'customStores', customStoreId(name)), {
      name: name.trim(),
      returnDays,
      updatedAt: serverTimestamp(),
    }),
  );
}
