import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  amountsIn,
  editDistance,
  findDate,
  findItems,
  findStore,
  findTotal,
  isReadable,
  parseReceipt,
} from '@/features/scan/parseReceipt';

const TODAY = '2026-11-16';
const FIXTURES = join(__dirname, '../../tests/fixtures/receipts');

type Expected = { store: string | null; date: string | null; totalCents: number | null };

describe('TC-401: parser accuracy on 30 OCR samples', () => {
  const expected = JSON.parse(readFileSync(join(FIXTURES, 'expected.json'), 'utf8')) as Record<
    string,
    Expected
  >;
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.txt'));

  const rows = files.map((file) => {
    const name = file.replace(/\.txt$/, '');
    const want = expected[name];
    const got = parseReceipt(readFileSync(join(FIXTURES, file), 'utf8'), TODAY);
    return {
      name,
      store: got.storeId === want.store,
      date: got.purchaseDate === want.date,
      total: got.amountCents === want.totalCents,
      got,
      want,
    };
  });

  const pct = (key: 'store' | 'date' | 'total') =>
    Math.round((rows.filter((r) => r[key]).length / rows.length) * 1000) / 10;

  afterAll(() => {
    const mark = (ok: boolean) => (ok ? 'ok ' : 'MISS');
    const table = [
      'Sample                         Store Date Total',
      ...rows.map((r) => `${r.name.padEnd(30)} ${mark(r.store)}  ${mark(r.date)} ${mark(r.total)}`),
      `Accuracy: store ${pct('store')}% (need 80) · date ${pct('date')}% (need 90) · total ${pct('total')}% (need 85)`,
    ].join('\n');
    // Printed so the gate report can quote it.
    console.log(table);
  });

  it('has 30 samples, each with expected values', () => {
    expect(files).toHaveLength(30);
    for (const r of rows) expect(r.want).toBeDefined();
  });

  it('finds the store in at least 80%', () => expect(pct('store')).toBeGreaterThanOrEqual(80));
  it('finds the date in at least 90%', () => expect(pct('date')).toBeGreaterThanOrEqual(90));
  it('finds the total in at least 85%', () => expect(pct('total')).toBeGreaterThanOrEqual(85));
});

describe('store', () => {
  it('matches names and aliases in any case', () => {
    expect(findStore(['WAL-MART SUPERCENTER'])?.id).toBe('walmart');
    expect(findStore(['the home depot'])?.id).toBe('home-depot');
  });

  it('allows 1–2 OCR typos in longer names only', () => {
    expect(findStore(['WALMAPT'])?.id).toBe('walmart');
    expect(findStore(['WALGRENES'])?.id).toBe('walgreens');
    expect(findStore(['CAP'])).toBeNull(); // not "Gap"
  });

  it('prefers the name at the top over an item further down', () => {
    expect(findStore(['Walmart', 'ST# 0123', 'APPLE JUICE 3.48'])?.id).toBe('walmart');
  });

  it('measures edits', () => {
    expect(editDistance('walmart', 'walmapt')).toBe(1);
    expect(editDistance('target', 'targets')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('date', () => {
  it.each([
    ['11/12/2026', '2026-11-12'],
    ['11/12/26 14:14', '2026-11-12'],
    ['1/5/2026', '2026-01-05'],
    ['Nov 12, 2026', '2026-11-12'],
    ['November 3 2026', '2026-11-03'],
    ['Date: 2026-07-04', '2026-07-04'],
  ])('reads %s', (line, iso) => expect(findDate([line], TODAY)).toBe(iso));

  it('rejects future and impossible dates', () => {
    expect(findDate(['12/25/2026'], TODAY)).toBeNull();
    expect(findDate(['02/30/2026'], TODAY)).toBeNull();
    expect(findDate(['Return by 12/25/2026', 'Bought 11/01/2026'], TODAY)).toBe('2026-11-01');
  });

  it('ignores phone numbers', () => {
    expect(findDate(['(612) 555-0134', '612-555-0134'], TODAY)).toBeNull();
  });
});

describe('total', () => {
  it('uses TOTAL, never SUBTOTAL or TAX', () => {
    expect(findTotal(['SUBTOTAL 89.00', 'TAX 6.23', 'TOTAL 95.23'])).toBe(9523);
    expect(findTotal(['SUBTOTAL 89.00', 'TAX 6.23'])).toBeNull();
  });

  it('reads AMOUNT DUE and ignores BALANCE DUE 0.00 after payment', () => {
    expect(findTotal(['AMOUNT DUE $1,204.50'])).toBe(120450);
    expect(findTotal(['TOTAL 382.36', 'VISA 382.36', 'BALANCE DUE 0.00'])).toBe(38236);
  });

  it('skips savings lines', () => {
    expect(findTotal(['TOTAL 86.80', 'TOTAL SAVINGS 132.00'])).toBe(8680);
  });

  it('pairs a label column with an amount column', () => {
    expect(findTotal(['SUBTOTAL', 'TAX', 'TOTAL', '$31.98', '$2.62', '$34.60'])).toBe(3460);
    expect(findTotal(['TOTAL', '$12.00'])).toBe(1200);
  });

  it('reads money with OCR slips', () => {
    expect(amountsIn('TOTAL 18.9O')).toEqual([1890]);
    expect(amountsIn('$1,234.56 and 7,50')).toEqual([123456, 750]);
  });
});

describe('items and readability', () => {
  it('keeps priced lines and drops totals and payments', () => {
    expect(
      findItems([
        '068113112345 AIR FRYER 5.8QT 89.00 N',
        'SUBTOTAL 89.00',
        'VISA TEND 89.00',
        'TOTAL 89.00',
      ]),
    ).toEqual(['AIR FRYER 5.8QT']);
  });

  it('calls a blank page unreadable', () => {
    expect(isReadable(parseReceipt('', TODAY))).toBe(false);
    expect(isReadable(parseReceipt('   \n\n  ', TODAY))).toBe(false);
  });
});
