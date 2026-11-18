/** Warranties tab (S14): products still under warranty, soonest end first. */
import type { Receipt } from '@/features/receipts/types';
import {
  calendarDaysBetween,
  calendarMonthsBetween,
  formatMediumDate,
  monthsLabel,
  type IsoDate,
} from '@/lib/dates';

/** The amber banner and pill start this many months before coverage ends. */
export const WARNING_MONTHS = 4;

export type Warranty = {
  receipt: Receipt;
  /** First item, or the store when the receipt lists none. */
  product: string;
  end: IsoDate;
  monthsLeft: number;
  /** WARNING_MONTHS or fewer whole months left ("4 mo" is still a warning). */
  endingSoon: boolean;
};

/** Receipts with a warranty that has not ended, not returned, sorted by end date. */
export function activeWarranties(receipts: readonly Receipt[], today: IsoDate): Warranty[] {
  return receipts
    .filter(
      (r): r is Receipt & { warrantyEnd: IsoDate } =>
        r.status !== 'returned' && r.warrantyEnd !== null && r.warrantyEnd >= today,
    )
    .map((r) => ({
      receipt: r,
      product: r.items[0] ?? r.storeName,
      end: r.warrantyEnd,
      monthsLeft: calendarMonthsBetween(today, r.warrantyEnd),
      endingSoon: calendarMonthsBetween(today, r.warrantyEnd) <= WARNING_MONTHS,
    }))
    .sort((a, b) =>
      a.end === b.end ? a.product.localeCompare(b.product) : a.end < b.end ? -1 : 1,
    );
}

/** "4 mo", "1 yr 10 mo", or days in the last month ("12 days", "Today"). */
export function timeLeftLabel(w: Pick<Warranty, 'end' | 'monthsLeft'>, today: IsoDate): string {
  if (w.monthsLeft >= 1) return monthsLabel(w.monthsLeft);
  const days = calendarDaysBetween(today, w.end);
  if (days <= 0) return 'Today';
  return days === 1 ? '1 day' : `${days} days`;
}

/** "Target · ends Mar 20, 2027" */
export function warrantySubtitle(w: Warranty): string {
  return `${w.receipt.storeName} · ends ${formatMediumDate(w.end)}`;
}

/** Amber banner text for the warranty that ends first, if it ends within WARNING_MONTHS. */
export function endingSoonMessage(list: readonly Warranty[], today: IsoDate): string | null {
  const first = list[0];
  if (!first?.endingSoon) return null;
  const left =
    first.monthsLeft >= 1
      ? `in ${first.monthsLeft === 1 ? '1 month' : `${first.monthsLeft} months`}`
      : calendarDaysBetween(today, first.end) <= 0
        ? 'today'
        : `in ${timeLeftLabel(first, today)}`;
  const by = formatMediumDate(first.end).replace(/, \d{4}$/, '');
  return `${first.product} warranty ends ${left}. Check it works before ${by}.`;
}
