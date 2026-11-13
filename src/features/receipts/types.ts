import type { IsoDate } from '@/lib/dates';

/** Stored status. "expired" is set only by the server (Phase 5); the app also derives it from the date. */
export type ReceiptStatus = 'active' | 'returned' | 'kept' | 'expired';

/** users/{uid}/receipts/{id} */
export type Receipt = {
  id: string;
  storeId: string | null;
  storeName: string;
  purchaseDate: IsoDate;
  amountCents: number;
  items: string[];
  returnDays: number;
  returnDeadline: IsoDate;
  warrantyMonths: number | null;
  warrantyEnd: IsoDate | null;
  status: ReceiptStatus;
  photoPaths: string[];
  /** Milliseconds; null while a new receipt waits for the server time. */
  createdAt: number | null;
  statusChangedAt: number | null;
  /** True while the latest change is only on this device (offline or not yet acknowledged). */
  pending: boolean;
};

/** What the receipt form produces (new and edit). */
export type ReceiptInput = {
  storeId: string | null;
  storeName: string;
  purchaseDate: IsoDate;
  amountCents: number;
  items: string[];
  returnDays: number;
};

/** The parts of users/{uid} the receipt screens use. */
export type UserProfile = {
  isPro: boolean;
  activeCount: number;
  freeLimit: number;
  reminderHour: number;
  reminderDays: number[];
  timezone: string;
};

/** users/{uid}/customStores/{id}: a return window remembered for a store the user typed. */
export type CustomStore = { id: string; name: string; returnDays: number };

/** What a list row and the filters show: the stored status, with active receipts past their deadline shown as expired. */
export type DisplayStatus = 'active' | 'returned' | 'kept' | 'expired';
