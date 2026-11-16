import { z } from 'zod';

import { isIsoDate, type IsoDate } from '@/lib/dates';
import { isValidAmount, parseUsd } from '@/lib/money';

import type { ReceiptInput } from './types';

export const MAX_ITEMS = 50;
export const MAX_ITEM_LENGTH = 80;
export const MAX_RETURN_DAYS = 365;

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
  });
}

export type ReceiptFormValues = z.infer<ReturnType<typeof receiptFormSchema>>;

export function toReceiptInput(v: ReceiptFormValues): ReceiptInput {
  return {
    storeId: v.storeId,
    storeName: v.storeName.trim(),
    purchaseDate: v.purchaseDate,
    amountCents: parseUsd(v.amount) ?? 0,
    items: splitItems(v.items),
    returnDays: v.returnDays,
  };
}
