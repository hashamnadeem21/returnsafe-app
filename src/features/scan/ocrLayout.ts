/**
 * Text recognition reads a receipt's label column and amount column as separate lines ("TOTAL"
 * and, further across, "89.00"). This puts every line back on its printed row by position, so
 * the parser sees "TOTAL 89.00". Pure, so it is unit tested.
 */
import type { RecognizedLine } from '../../../modules/receipt-text';

export type OcrLine = RecognizedLine;
type OcrRect = RecognizedLine['frame'];

const centerY = (r: OcrRect) => (r.top + r.bottom) / 2;
const heightOf = (r: OcrRect) => Math.max(1, r.bottom - r.top);

/**
 * Same printed row when the vertical centres are within half a typical line, or when the boxes
 * overlap by at least half the shorter one (a large "TOTAL" next to a small amount).
 */
function sameRow(a: OcrRect, b: OcrRect, typical: number): boolean {
  if (Math.abs(centerY(a) - centerY(b)) <= typical / 2) return true;
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return overlap >= Math.min(heightOf(a), heightOf(b)) / 2;
}

/** Text with one receipt row per line, top to bottom and left to right. */
export function textFromLines(recognized: readonly OcrLine[]): string {
  const lines = recognized.filter((l) => l.text.trim().length > 0);
  if (lines.length === 0) return '';

  const heights = lines.map((l) => heightOf(l.frame)).sort((a, b) => a - b);
  const typical = heights[Math.floor(heights.length / 2)];
  const sorted = [...lines].sort((a, b) => centerY(a.frame) - centerY(b.frame));

  const rows: OcrLine[][] = [];
  for (const line of sorted) {
    const row = rows[rows.length - 1];
    if (row && sameRow(line.frame, row[0].frame, typical)) row.push(line);
    else rows.push([line]);
  }
  return rows
    .map((row) =>
      row
        .sort((a, b) => a.frame.left - b.frame.left)
        .map((l) => l.text.trim())
        .join(' '),
    )
    .join('\n');
}
