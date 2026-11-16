/** US dollars, stored as whole cents so sums never pick up floating-point errors. */

export const MIN_CENTS = 1;
/** $99,999.99 */
export const MAX_CENTS = 9_999_999;

const AMOUNT = /^(\d{1,3}(,\d{3})*|\d+)(\.(\d{0,2}))?$/;

/** "48.20", "$1,299", "  .5 " → cents; anything else (or more than 2 decimals) → null. */
export function parseUsd(input: string): number | null {
  const text = input.trim().replace(/^\$\s*/, '');
  if (text === '' || text === '.') return null;
  const normalised = text.startsWith('.') ? `0${text}` : text;
  const m = AMOUNT.exec(normalised);
  if (!m) return null;
  const dollars = Number(m[1].replace(/,/g, ''));
  const cents = Number((m[4] ?? '').padEnd(2, '0'));
  const total = dollars * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

/** 482000 → "$4,820.00" */
export function formatUsd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
}

/** 4820 → "48.20", for pre-filling an amount field. */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function isValidAmount(cents: number | null): cents is number {
  return cents !== null && Number.isInteger(cents) && cents >= MIN_CENTS && cents <= MAX_CENTS;
}
