/** Pure helpers that turn stored receipts into what the screens show. */
import { calendarDaysBetween, type IsoDate } from '@/lib/dates';

import type { DisplayStatus, Receipt, UserProfile } from './types';

/** Receipts due within this many days are "Due soon". */
export const DUE_SOON_DAYS = 7;

export function daysLeftFor(r: Receipt, today: IsoDate): number {
  return calendarDaysBetween(today, r.returnDeadline);
}

/** Active receipts whose last return day has passed show as expired until the server marks them. */
export function displayStatus(r: Receipt, today: IsoDate): DisplayStatus {
  if (r.status === 'active' && daysLeftFor(r, today) < 0) return 'expired';
  return r.status;
}

export function isDueSoon(r: Receipt, today: IsoDate): boolean {
  if (displayStatus(r, today) !== 'active') return false;
  return daysLeftFor(r, today) <= DUE_SOON_DAYS;
}

export type Totals = {
  protectedCents: number;
  activeCount: number;
  savedCents: number;
  returnedCount: number;
};

/** Money protected = still returnable; money saved = marked returned. */
export function totals(receipts: readonly Receipt[], today: IsoDate): Totals {
  const t: Totals = { protectedCents: 0, activeCount: 0, savedCents: 0, returnedCount: 0 };
  for (const r of receipts) {
    const s = displayStatus(r, today);
    if (s === 'active') {
      t.protectedCents += r.amountCents;
      t.activeCount += 1;
    } else if (s === 'returned') {
      t.savedCents += r.amountCents;
      t.returnedCount += 1;
    }
  }
  return t;
}

export type ReceiptFilter = 'all' | 'dueSoon' | 'active' | 'returned' | 'kept' | 'expired';

export const FILTERS: { key: ReceiptFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dueSoon', label: 'Due soon' },
  { key: 'active', label: 'Active' },
  { key: 'returned', label: 'Returned' },
  { key: 'kept', label: 'Kept' },
  { key: 'expired', label: 'Expired' },
];

export function matchesFilter(r: Receipt, f: ReceiptFilter, today: IsoDate): boolean {
  if (f === 'all') return true;
  if (f === 'dueSoon') return isDueSoon(r, today);
  return displayStatus(r, today) === f;
}

/** Case-insensitive match on the store name or any item. */
export function matchesSearch(r: Receipt, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return (
    r.storeName.toLowerCase().includes(query) ||
    r.items.some((i) => i.toLowerCase().includes(query))
  );
}

export function filterCounts(
  receipts: readonly Receipt[],
  today: IsoDate,
): Record<ReceiptFilter, number> {
  const counts = { all: 0, dueSoon: 0, active: 0, returned: 0, kept: 0, expired: 0 };
  for (const r of receipts) {
    for (const { key } of FILTERS) if (matchesFilter(r, key, today)) counts[key] += 1;
  }
  return counts;
}

export type ReceiptGroup = { key: string; title: string; receipts: Receipt[] };

/** Grouped by urgency, then expired, returned and kept lower down. */
export function groupReceipts(receipts: readonly Receipt[], today: IsoDate): ReceiptGroup[] {
  const byDeadline = (a: Receipt, b: Receipt) => a.returnDeadline.localeCompare(b.returnDeadline);
  const recentFirst = (a: Receipt, b: Receipt) =>
    (b.statusChangedAt ?? 0) - (a.statusChangedAt ?? 0) ||
    b.purchaseDate.localeCompare(a.purchaseDate);
  const groups: ReceiptGroup[] = [
    { key: 'week', title: 'THIS WEEK', receipts: [] },
    { key: 'later', title: 'LATER', receipts: [] },
    { key: 'expired', title: 'EXPIRED', receipts: [] },
    { key: 'returned', title: 'RETURNED', receipts: [] },
    { key: 'kept', title: 'KEPT', receipts: [] },
  ];
  const at = (key: string) => groups.find((g) => g.key === key)!.receipts;
  for (const r of receipts) {
    const s = displayStatus(r, today);
    if (s === 'active') at(isDueSoon(r, today) ? 'week' : 'later').push(r);
    else at(s).push(r);
  }
  at('week').sort(byDeadline);
  at('later').sort(byDeadline);
  at('expired').sort((a, b) => byDeadline(b, a));
  at('returned').sort(recentFirst);
  at('kept').sort(recentFirst);
  return groups.filter((g) => g.receipts.length > 0);
}

/** Free users may hold `freeLimit` active receipts; counts the server's number and the local one. */
export function canAddActive(profile: UserProfile | null, receipts: readonly Receipt[]): boolean {
  if (!profile) return true;
  if (profile.isPro) return true;
  const local = receipts.filter((r) => r.status === 'active').length;
  return Math.max(profile.activeCount, local) < profile.freeLimit;
}

export function activeUsed(profile: UserProfile | null, receipts: readonly Receipt[]): number {
  const local = receipts.filter((r) => r.status === 'active').length;
  return Math.max(profile?.activeCount ?? 0, local);
}

/** One line under a row: items and the total. */
export function itemsLine(r: Receipt, formatted: string): string {
  return r.items.length > 0 ? `${r.items.join(', ')} · ${formatted}` : formatted;
}
