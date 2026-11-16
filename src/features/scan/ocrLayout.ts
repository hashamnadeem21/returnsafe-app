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
    // Same row when the vertical centres are within half a line of each other.
    if (row && Math.abs(centerY(line.frame) - centerY(row[0].frame)) <= typical / 2) row.push(line);
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
