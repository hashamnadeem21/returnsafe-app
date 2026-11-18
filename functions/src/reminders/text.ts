/** Push notification text for a reminder. */

export type ReminderKind = 'return' | 'warranty';

const MAX_ITEMS = 3;
const MAX_BODY = 120;

/** "$1,234.50" from whole cents. */
export function formatUsd(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}$${dollars}.${rest}`;
}

function inDays(days: number): string {
  if (days <= 0) return 'today';
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

/**
 * Title "<Store> return closes in <N> days" (or "<Store> warranty ends in <N> days") and body
 * "$<amount> · <items>". Only the first three items are listed, and the body is cut at 120
 * characters so it fits a notification.
 */
export function reminderText(r: {
  kind: ReminderKind;
  storeName: string;
  daysLeft: number;
  amountCents: number;
  items: readonly string[];
}): { title: string; body: string } {
  const store = r.storeName.trim() || 'Your';
  const title =
    r.kind === 'return'
      ? `${store} return closes ${inDays(r.daysLeft)}`
      : `${store} warranty ends ${inDays(r.daysLeft)}`;
  const items = r.items
    .map((i) => i.trim())
    .filter((i) => i.length > 0)
    .slice(0, MAX_ITEMS)
    .join(', ');
  let body = items ? `${formatUsd(r.amountCents)} · ${items}` : formatUsd(r.amountCents);
  if (body.length > MAX_BODY) body = `${body.slice(0, MAX_BODY - 1).trimEnd()}…`;
  return { title, body };
}
