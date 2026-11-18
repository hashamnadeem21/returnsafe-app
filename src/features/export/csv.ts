/** CSV export (S20): one row per receipt, RFC 4180 quoting, safe to open in a spreadsheet. */
import { displayStatus } from '@/features/receipts/derive';
import type { Receipt } from '@/features/receipts/types';
import type { IsoDate } from '@/lib/dates';

export const CSV_COLUMNS = [
  'Store',
  'Purchase date',
  'Total (USD)',
  'Items',
  'Return window (days)',
  'Return by',
  'Status',
  'Warranty (months)',
  'Warranty ends',
] as const;

const STATUS_WORDS = {
  active: 'Active',
  returned: 'Returned',
  kept: 'Kept',
  expired: 'Expired',
} as const;

/**
 * One CSV field. Text that a spreadsheet would run as a formula (=, +, -, @, tab or carriage
 * return first) gets a leading apostrophe; fields with a comma, quote or line break are quoted,
 * with quotes doubled.
 */
export function csvField(value: string | number | null): string {
  if (value === null) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** "48.20" */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function receiptRow(r: Receipt, today: IsoDate): (string | number | null)[] {
  return [
    r.storeName,
    r.purchaseDate,
    centsToDecimal(r.amountCents),
    r.items.join('; '),
    r.returnDays,
    r.returnDeadline,
    STATUS_WORDS[displayStatus(r, today)],
    r.warrantyMonths,
    r.warrantyEnd,
  ];
}

/** The whole file: a byte-order mark (so Excel reads UTF-8), a header row, CRLF line ends. */
export function receiptsCsv(receipts: readonly Receipt[], today: IsoDate): string {
  const lines = [
    CSV_COLUMNS.map(csvField).join(','),
    ...receipts.map((r) => receiptRow(r, today).map(csvField).join(',')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
