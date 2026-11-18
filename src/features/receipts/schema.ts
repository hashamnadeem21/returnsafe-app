import { z } from 'zod';

import { isIsoDate, type IsoDate } from '@/lib/dates';
import { isValidAmount, parseUsd } from '@/lib/money';

import type { ReceiptInput } from './types';

export const MAX_ITEMS = 50;
export const MAX_ITEM_LENGTH = 80;
export const MAX_RETURN_DAYS = 365;
export const MAX_WARRANTY_MONTHS = 120;
export const WARRANTY_ERROR = `Enter 1 to ${MAX_WARRANTY_MONTHS} months`;

/** "12" → 12; "" → null (no warranty); anything else → undefined (invalid). */
export function parseWarrantyMonths(text: string): number | null | undefined {
  const t = text.trim();
  if (t.length === 0) return null;
  if (!/^\d{1,3}$/.test(t)) return undefined;
  const n = Number(t);
  return n >= 1 && n <= MAX_WARRANTY_MONTHS ? n : undefined;
}

export const AMOUNT_ERROR = 'Enter an amount from $0.01 to $99,999.99';
export const FUTURE_DATE_ERROR = "The purchase date can't be in the future";

/** "Sneakers, bath towels" → ["Sneakers", "bath towels"] */
export function splitItems(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Form values (all strings except the window), checked against "today" in the user's time zone. */
export function receiptFormSchema(today: IsoDate) {
  return z.object({
    storeId: z.string().nullable(),
    storeName: z
      .string()
      .trim()
      .min(1, 'Choose a store')
      .max(80, 'Keep the store name under 80 characters'),
    purchaseDate: z
      .string()
      .refine(isIsoDate, 'Choose the purchase date')
      .refine((d) => d <= today, FUTURE_DATE_ERROR),
    amount: z
      .string()
      .refine((v) => v.trim().length > 0, 'Enter the total')
      .refine((v) => v.trim().length === 0 || isValidAmount(parseUsd(v)), AMOUNT_ERROR),
    items: z
      .string()
      .refine((v) => splitItems(v).length <= MAX_ITEMS, `Add up to ${MAX_ITEMS} items`)
      .refine(
        (v) => splitItems(v).every((i) => i.length <= MAX_ITEM_LENGTH),
        `Keep each item under ${MAX_ITEM_LENGTH} characters`,
      ),
    returnDays: z.number().int().min(1).max(MAX_RETURN_DAYS),
    /** Warranty length in months (Pro); empty for none. */
    warranty: z.string().refine((v) => parseWarrantyMonths(v) !== undefined, WARRANTY_ERROR),
  });
}

export type ReceiptFormValues = z.infer<ReturnType<typeof receiptFormSchema>>;

/**
 * `withWarranty` is false for Free users: the stored warranty is then left exactly as it is
 * (the rules only let Pro users add or change one).
 */
export function toReceiptInput(v: ReceiptFormValues, withWarranty = true): ReceiptInput {
  return {
    ...(withWarranty ? { warrantyMonths: parseWarrantyMonths(v.warranty) ?? null } : {}),
    storeId: v.storeId,
    storeName: v.storeName.trim(),
    purchaseDate: v.purchaseDate,
    amountCents: parseUsd(v.amount) ?? 0,
    items: splitItems(v.items),
    returnDays: v.returnDays,
  };
}
