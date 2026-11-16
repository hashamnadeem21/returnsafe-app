/**
 * Turns the text read from a receipt photo into a draft receipt. Pure: no React, no native code,
 * so it is tested against saved OCR samples (tests/fixtures/receipts).
 *
 * Everything is best effort: a field the parser is not sure about is left empty for the user.
 */
import { isIsoDate, type IsoDate } from '@/lib/dates';
import { MAX_CENTS, MIN_CENTS } from '@/lib/money';

import { normalizeStoreName, STORES, type StorePolicy } from '../receipts/stores';

export type ParsedReceipt = {
  storeId: string | null;
  storeName: string | null;
  purchaseDate: IsoDate | null;
  amountCents: number | null;
  items: string[];
};

/** At least one of store, date and total was found. */
export function isReadable(p: ParsedReceipt): boolean {
  return p.storeId !== null || p.purchaseDate !== null || p.amountCents !== null;
}

const MAX_ITEMS = 10;
const MAX_ITEM_LENGTH = 80;
/** Lines at the top of a receipt, where the store name usually is. */
const HEADER_LINES = 8;

function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

// ---------------------------------------------------------------------------------------------
// Store

/** Edit distance between two short strings (Levenshtein). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Edits allowed for a name of this length: none for short names, so "Gap" never matches "Cap". */
function allowedEdits(length: number): number {
  if (length >= 8) return 2;
  if (length >= 5) return 1;
  return 0;
}

type StoreKey = { store: StorePolicy; key: string };

function storeKeys(stores: readonly StorePolicy[]): StoreKey[] {
  const keys: StoreKey[] = [];
  for (const store of stores) {
    for (const name of [store.name, ...store.aliases]) {
      const key = normalizeStoreName(name);
      if (key.length >= 3) keys.push({ store, key });
    }
  }
  return keys;
}

/** Runs of 1–4 neighbouring words, joined the way store names are normalised. */
function wordRuns(line: string): string[] {
  const words = line
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^\p{L}\p{N}']+/u)
    .map((w) => w.replace(/'/g, ''))
    .filter((w) => w.length > 0);
  const runs: string[] = [];
  for (let i = 0; i < words.length; i++) {
    let run = '';
    for (let n = 0; n < 4 && i + n < words.length; n++) {
      run += words[i + n];
      runs.push(run);
    }
  }
  return runs;
}

/**
 * The built-in store named on the receipt. Names and aliases match exactly or within 1–2 typos
 * (OCR mistakes such as "WALMAPT"). A match near the top wins over one further down, so an item
 * called "Apple juice" does not turn a Walmart receipt into an Apple one.
 */
export function findStore(
  lines: string[],
  stores: readonly StorePolicy[] = STORES,
): StorePolicy | null {
  const keys = storeKeys(stores);
  let best: { store: StorePolicy; score: number; length: number } | null = null;
  lines.forEach((line, index) => {
    // Header lines count for more; a footer such as "Thank you for shopping at Target" still counts.
    const position = index < HEADER_LINES ? index : HEADER_LINES + index * 2;
    for (const run of wordRuns(line)) {
      for (const { store, key } of keys) {
        if (Math.abs(run.length - key.length) > 2) continue;
        const limit = allowedEdits(key.length);
        const distance = limit === 0 ? (run === key ? 0 : Infinity) : editDistance(run, key);
        if (distance > limit) continue;
        const score = position * 3 + distance;
        if (!best || score < best.score || (score === best.score && key.length > best.length)) {
          best = { store, score, length: key.length };
        }
      }
    }
  });
  return best ? (best as { store: StorePolicy }).store : null;
}

// ---------------------------------------------------------------------------------------------
// Date

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

function isoOf(year: number, month: number, day: number): IsoDate | null {
  if (year < 100) year += 2000;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return year >= 2000 && isIsoDate(iso) ? iso : null;
}

const DATE_PATTERNS: { re: RegExp; read: (m: RegExpExecArray) => IsoDate | null }[] = [
  // 11/12/2026, 11-12-26, 1/5/2026
  {
    re: /(?<![\d/.-])(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?![\d/-])/g,
    read: (m) => isoOf(Number(m[3]), Number(m[1]), Number(m[2])),
  },
  // 2026-11-12
  {
    re: /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g,
    read: (m) => isoOf(Number(m[1]), Number(m[2]), Number(m[3])),
  },
  // Nov 12, 2026 · November 12 2026
  {
    re: new RegExp(`\\b${MONTH}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi'),
    read: (m) =>
      isoOf(Number(m[3]), MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, Number(m[2])),
  },
  // 12 Nov 2026
  {
    re: new RegExp(`\\b(\\d{1,2})\\s+${MONTH},?\\s+(\\d{4})\\b`, 'gi'),
    read: (m) =>
      isoOf(Number(m[3]), MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, Number(m[1])),
  },
];

/** The first real, non-future purchase date on the receipt (US formats). */
export function findDate(lines: string[], today: IsoDate): IsoDate | null {
  for (const line of lines) {
    const found: { at: number; date: IsoDate }[] = [];
    for (const { re, read } of DATE_PATTERNS) {
      re.lastIndex = 0;
      for (let m = re.exec(line); m; m = re.exec(line)) {
        const date = read(m);
        if (date && date <= today) found.push({ at: m.index, date });
      }
    }
    if (found.length > 0) return found.sort((a, b) => a.at - b.at)[0].date;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Total

/** "$1,234.56", "89.00", "89,00" and OCR slips such as "89.O0". Returns cents. */
const MONEY = /(?<![\d.,])-?\$?\s?((?:\d{1,3}(?:,\d{3})+)|\d+)\s?[.,]\s?([\dOo]{2})(?![\d%])/g;

export function amountsIn(line: string): number[] {
  const out: number[] = [];
  MONEY.lastIndex = 0;
  for (let m = MONEY.exec(line); m; m = MONEY.exec(line)) {
    if (m[0].trim().startsWith('-')) continue;
    const cents = Number(m[1].replace(/,/g, '')) * 100 + Number(m[2].replace(/[Oo]/g, '0'));
    if (Number.isFinite(cents)) out.push(cents);
  }
  return out;
}

const TOTAL_WORDS = /\b(GRAND TOTAL|ORDER TOTAL|TOTAL|AMOUNT DUE|AMT DUE|BALANCE DUE|BALANCE)\b/;
const NOT_TOTAL =
  /SUB\s?-?\s?TOTAL|\bTAX\b|SAVINGS|SAVED|\bSAVE\b|DISCOUNT|\bITEMS?\b|\bQTY\b|POINTS|REWARD|CARD BALANCE|REMAINING|PREVIOUS|CHANGE|\bTIP\b|\bCOUNT\b|BEFORE/;

const AMOUNT_ONLY = /^[\s$\d.,Oo-]+$/;
const isAmountOnly = (line: string) => AMOUNT_ONLY.test(line) && amountsIn(line).length > 0;

/**
 * The amount for a label line that has none of its own. OCR often reads the label column and
 * the amount column separately ("TOTAL" … then "$34.60" a few lines down): a run of label
 * lines followed by a run of amounts pairs up from the bottom (the header above the labels has
 * no amounts). Otherwise an amount on the next line is used.
 */
function amountBelow(lines: string[], i: number): number | null {
  let end = i;
  while (end + 1 < lines.length && amountsIn(lines[end + 1]).length === 0) end++;
  const column: number[] = [];
  for (let at = end + 1; at < lines.length && isAmountOnly(lines[at]); at++) {
    column.push(amountsIn(lines[at])[0]);
  }
  const fromBottom = end - i;
  if (column.length >= 2 && fromBottom < column.length) {
    return column[column.length - 1 - fromBottom];
  }
  const next = lines[i + 1];
  return next && isAmountOnly(next) ? amountsIn(next)[0] : null;
}

/**
 * The amount next to TOTAL, AMOUNT DUE or BALANCE DUE (never SUBTOTAL or TAX). The largest such
 * amount wins, so "BALANCE DUE 0.00" after payment does not replace the real total.
 */
export function findTotal(lines: string[]): number | null {
  const candidates: number[] = [];
  lines.forEach((line, i) => {
    // OCR reads O as 0 in words ("T0TAL"); amounts are read from the original line.
    const upper = line.toUpperCase().replace(/0/g, 'O');
    if (!TOTAL_WORDS.test(upper) || NOT_TOTAL.test(upper)) return;
    const here = amountsIn(line);
    if (here.length > 0) {
      candidates.push(here[here.length - 1]);
      return;
    }
    const below = amountBelow(lines, i);
    if (below !== null) candidates.push(below);
  });
  const valid = candidates.filter((c) => c >= MIN_CENTS && c <= MAX_CENTS);
  return valid.length > 0 ? Math.max(...valid) : null;
}

// ---------------------------------------------------------------------------------------------
// Items

const NOT_ITEM =
  /TOTAL|\bTAX\b|CHANGE|\bCASH\b|VISA|MASTERCARD|\bAMEX\b|DISCOVER|DEBIT|CREDIT|TEND|BALANCE|SAVINGS|DISCOUNT|COUPON|\bDUE\b|PAYMENT|\bCARD\b|\bAUTH|APPROV|REFUND|\bPAID\b|SUB\s?TOTAL|\bREWARD|\bPOINTS\b|\bACCT\b|\bTRAN/i;

/** Lines that end in a price, cleaned up into item names (best effort). */
export function findItems(lines: string[]): string[] {
  const items: string[] = [];
  for (const line of lines) {
    if (items.length >= MAX_ITEMS) break;
    if (NOT_ITEM.test(line) || amountsIn(line).length === 0) continue;
    const priced = line.match(/^(.*?)\s+-?\$?\d[\d,]*[.,][\dOo]{2}\s*[A-Z]{0,2}\s*$/);
    if (!priced) continue;
    const name = priced[1]
      .replace(/^\d{4,}\s+/, '') // item code
      .replace(/\s+\d{6,}\b/g, '') // UPC
      .replace(/^\d+\s*@\s*/, '') // "2 @"
      .replace(/\s+\d+\s*@\s*\$?[\d.]+$/, '') // "2 @ 4.99"
      .replace(/\s+[A-Z]$/, '') // tax flag
      .trim();
    if ((name.match(/\p{L}/gu) ?? []).length < 3) continue;
    items.push(name.slice(0, MAX_ITEM_LENGTH));
  }
  return items;
}

// ---------------------------------------------------------------------------------------------

export function parseReceipt(
  text: string,
  today: IsoDate,
  stores: readonly StorePolicy[] = STORES,
): ParsedReceipt {
  const lines = linesOf(text);
  const store = findStore(lines, stores);
  return {
    storeId: store?.id ?? null,
    storeName: store?.name ?? null,
    purchaseDate: findDate(lines, today),
    amountCents: findTotal(lines),
    items: findItems(lines),
  };
}
