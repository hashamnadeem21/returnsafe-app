import { addCalendarDays, computeDeadline } from '@/lib/dates';
import {
  activeUsed,
  canAddActive,
  displayStatus,
  filterCounts,
  groupReceipts,
  isDueSoon,
  matchesSearch,
  totals,
} from '@/features/receipts/derive';
import {
  FUTURE_DATE_ERROR,
  AMOUNT_ERROR,
  receiptFormSchema,
  splitItems,
} from '@/features/receipts/schema';
import {
  STORES,
  customStoreId,
  findStoreByName,
  policySummary,
  searchStores,
} from '@/features/receipts/stores';
import type { Receipt, UserProfile } from '@/features/receipts/types';

const TODAY = '2026-11-13';

function receipt(over: Partial<Receipt> = {}): Receipt {
  const purchaseDate = over.purchaseDate ?? TODAY;
  const returnDays = over.returnDays ?? 90;
  return {
    id: over.id ?? 'r1',
    storeId: 'target',
    storeName: 'Target',
    purchaseDate,
    amountCents: 4820,
    items: [],
    returnDays,
    returnDeadline: computeDeadline(purchaseDate, returnDays),
    warrantyMonths: null,
    warrantyEnd: null,
    status: 'active',
    photoPaths: [],
    createdAt: 1,
    statusChangedAt: null,
    pending: false,
    ...over,
  };
}

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  isPro: false,
  activeCount: 0,
  freeLimit: 5,
  reminderHour: 9,
  reminderDays: [7, 3, 1],
  timezone: 'America/New_York',
  ...over,
});

describe('receipt form validation', () => {
  const schema = receiptFormSchema(TODAY);
  const valid = {
    storeId: 'target',
    storeName: 'Target',
    purchaseDate: TODAY,
    amount: '48.20',
    items: '',
    returnDays: 90,
  };

  it('accepts a complete receipt', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('TC-313 (unit): blocks a future date and a zero amount with their own messages', () => {
    const r = schema.safeParse({ ...valid, purchaseDate: addCalendarDays(TODAY, 1), amount: '0' });
    expect(r.success).toBe(false);
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages).toContain(FUTURE_DATE_ERROR);
    expect(messages).toContain(AMOUNT_ERROR);
  });

  it('requires a store and a total', () => {
    const r = schema.safeParse({ ...valid, storeName: '  ', amount: '' });
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages).toEqual(expect.arrayContaining(['Choose a store', 'Enter the total']));
  });

  it('splits items on commas and new lines', () => {
    expect(splitItems('Sneakers, bath towels\nHDMI cable ,, ')).toEqual([
      'Sneakers',
      'bath towels',
      'HDMI cable',
    ]);
  });
});

describe('built-in stores', () => {
  it('has 50 stores with unique ids and a policy link', () => {
    expect(STORES).toHaveLength(50);
    expect(new Set(STORES.map((s) => s.id)).size).toBe(50);
    expect(STORES.every((s) => s.policyUrl.startsWith('https://'))).toBe(true);
  });

  it('TC-311 (unit): "tar" finds Target first', () => {
    const names = searchStores('tar', []).map((m) => m.store.name);
    expect(names[0]).toBe('Target');
  });

  it('puts the user’s own stores first and matches spellings alike', () => {
    const custom = [{ id: 'joesbikes', name: "Joe's Bikes", returnDays: 30 }];
    expect(searchStores('joes', custom)[0]).toEqual({ kind: 'custom', store: custom[0] });
    expect(customStoreId("Joe's Bikes")).toBe(customStoreId('joes bikes'));
  });

  it('recognises aliases', () => {
    expect(findStoreByName('target')?.id).toBe('target');
    expect(findStoreByName('Nowhere Shop')).toBeUndefined();
  });

  it('summarises a policy', () => {
    expect(policySummary(90, 'Most items. Electronics 30 days.')).toBe('Most items · 90 days');
  });
});

describe('derived receipt state', () => {
  it('shows active receipts past the deadline as expired', () => {
    const r = receipt({ purchaseDate: '2026-08-01', returnDays: 30 });
    expect(displayStatus(r, TODAY)).toBe('expired');
    expect(isDueSoon(r, TODAY)).toBe(false);
  });

  it('counts money protected and money saved', () => {
    const list = [
      receipt({ id: 'a', amountCents: 1000 }),
      receipt({ id: 'b', amountCents: 4820, status: 'returned' }),
      receipt({ id: 'c', amountCents: 500, status: 'kept' }),
    ];
    expect(totals(list, TODAY)).toEqual({
      protectedCents: 1000,
      activeCount: 1,
      savedCents: 4820,
      returnedCount: 1,
    });
  });

  it('groups by urgency and counts each filter', () => {
    const list = [
      receipt({ id: 'soon', purchaseDate: '2026-08-20' }), // 7 days left
      receipt({ id: 'later' }),
      receipt({ id: 'back', status: 'returned' }),
    ];
    expect(groupReceipts(list, TODAY).map((g) => [g.title, g.receipts.map((r) => r.id)])).toEqual([
      ['THIS WEEK', ['soon']],
      ['LATER', ['later']],
      ['RETURNED', ['back']],
    ]);
    expect(filterCounts(list, TODAY)).toEqual({
      all: 3,
      dueSoon: 1,
      active: 2,
      returned: 1,
      kept: 0,
      expired: 0,
    });
  });

  it('searches store names and items', () => {
    const r = receipt({ items: ['Kids sneakers'] });
    expect(matchesSearch(r, 'TAR')).toBe(true);
    expect(matchesSearch(r, 'sneak')).toBe(true);
    expect(matchesSearch(r, 'walmart')).toBe(false);
  });

  it('TC-306 (unit): a free user with 5 active receipts cannot add another; Pro can', () => {
    const five = ['1', '2', '3', '4', '5'].map((id) => receipt({ id }));
    expect(canAddActive(profile({ activeCount: 4 }), five.slice(0, 4))).toBe(true);
    expect(canAddActive(profile({ activeCount: 5 }), five)).toBe(false);
    // The local count wins while the server count catches up (offline).
    expect(canAddActive(profile({ activeCount: 4 }), five)).toBe(false);
    expect(canAddActive(profile({ activeCount: 5, isPro: true }), five)).toBe(true);
    expect(activeUsed(profile({ activeCount: 3 }), five)).toBe(5);
  });
});
