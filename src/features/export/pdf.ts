/** PDF export (S20): one receipt per page with its photos, for insurance, taxes or records. */
import { displayStatus } from '@/features/receipts/derive';
import type { Receipt } from '@/features/receipts/types';
import { formatLongDate, formatMediumDate, type IsoDate } from '@/lib/dates';
import { formatUsd } from '@/lib/money';
import { palettes } from '@/theme';

const STATUS_WORDS = {
  active: 'Active',
  returned: 'Returned',
  kept: 'Kept',
  expired: 'Return window closed',
} as const;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const row = (label: string, value: string) =>
  `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;

function page(r: Receipt, photos: readonly string[], today: IsoDate): string {
  const rows = [
    row('Purchase date', formatLongDate(r.purchaseDate)),
    row('Total', formatUsd(r.amountCents)),
    row('Items', r.items.length > 0 ? r.items.join(', ') : '—'),
    row('Return window', `${r.returnDays} days`),
    row('Return by', formatLongDate(r.returnDeadline)),
    row('Status', STATUS_WORDS[displayStatus(r, today)]),
    ...(r.warrantyMonths && r.warrantyEnd
      ? [row('Warranty', `${r.warrantyMonths} months, ends ${formatMediumDate(r.warrantyEnd)}`)]
      : []),
  ].join('');
  const images = photos.map((src) => `<img src="${src}" alt="Receipt photo" />`).join('');
  return `<section class="page"><h1>${escapeHtml(r.storeName)}</h1><table>${rows}</table>${
    images ? `<div class="photos">${images}</div>` : '<p class="none">No photo</p>'
  }</section>`;
}

/**
 * The report as HTML for expo-print. `photos` maps a Storage path to an image source (a data URI,
 * so printing never waits on the network); photos that could not be loaded are left out.
 */
export function receiptsHtml(
  receipts: readonly Receipt[],
  photos: Readonly<Record<string, string>>,
  today: IsoDate,
): string {
  const c = palettes.light;
  const pages = receipts
    .map((r) =>
      page(
        r,
        r.photoPaths.map((p) => photos[p]).filter((p): p is string => !!p),
        today,
      ),
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
@page { margin: 36px; }
body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: ${c.ink}; margin: 0; }
.page { page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
h1 { font-size: 22px; margin: 0 0 12px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 16px; font-size: 13px; }
th { text-align: left; color: ${c.ink2}; font-weight: 500; width: 34%; }
th, td { padding: 6px 0; border-bottom: 1px solid ${c.border}; vertical-align: top; }
.photos img { display: block; max-width: 100%; max-height: 560px; margin: 0 auto 12px; }
.none { color: ${c.muted}; font-size: 13px; }
footer { color: ${c.muted}; font-size: 11px; }
</style></head><body>${pages}<footer>Exported from ReturnSafe on ${escapeHtml(
    formatLongDate(today),
  )}</footer></body></html>`;
}
