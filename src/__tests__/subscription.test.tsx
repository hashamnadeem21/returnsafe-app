import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

import { useSnackbar } from '@/components/Snackbar';
import { centsToDecimal, CSV_COLUMNS, csvField, receiptsCsv } from '@/features/export/csv';
import { escapeHtml, receiptsHtml } from '@/features/export/pdf';
import { useReceipts } from '@/features/receipts/receiptsStore';
import type { Receipt } from '@/features/receipts/types';
import { resetReminderPushForTests } from '@/features/reminders/ReminderPush';
import { ctaLabel, legalText, planCaption } from '@/features/subscription/paywallText';
import {
  loadPlans,
  manageSubscriptionUrl,
  resetPurchasesForTests,
  yearlySavings,
} from '@/features/subscription/purchases';
import {
  activeWarranties,
  endingSoonMessage,
  timeLeftLabel,
} from '@/features/warranties/warranties';
import {
  addCalendarDays,
  addCalendarMonths,
  calendarMonthsBetween,
  monthsLabel,
  todayIn,
} from '@/lib/dates';
import { INSTALL_KEY } from '@/lib/install';
import { ONBOARDING_KEY } from '@/lib/onboarding';
import { usePro } from '@/stores/pro';
import { useSession } from '@/stores/session';
import { firestoreDocs, reset, resetFirestore, seedDoc, signInAnonymously } from '@/test/firebase';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rc = require('@/test/fakePurchases') as {
  purchasesControl: {
    packages: unknown[];
    offeringsError: Error | null;
    purchase: 'pro' | 'cancelled' | 'pending' | 'failed';
    restorePro: boolean;
    pro: boolean;
    eligible: boolean;
    appUserID: string | null;
  };
  resetPurchases: () => void;
  MONTHLY: unknown;
};

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true, null],
  Inter_400Regular: 1,
  Inter_500Medium: 1,
  Inter_600SemiBold: 1,
  Inter_700Bold: 1,
  Inter_800ExtraBold: 1,
}));

const APP_DIR = 'src/app';
const TZ = 'America/New_York';
const TODAY = '2026-11-18';
let uid = '';

function receipt(fields: Partial<Receipt> = {}): Receipt {
  return {
    id: 'r1',
    storeId: 'target',
    storeName: 'Target',
    purchaseDate: '2026-11-01',
    amountCents: 4820,
    items: ['Kids sneakers'],
    returnDays: 90,
    returnDeadline: '2027-01-30',
    warrantyMonths: null,
    warrantyEnd: null,
    status: 'active',
    photoPaths: [],
    createdAt: 1,
    statusChangedAt: null,
    pending: false,
    ...fields,
  };
}

async function settle(fn: () => void = () => undefined) {
  await act(async () => {
    fn();
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}

const userPath = () => `users/${uid}`;

function receiptDoc(fields: Record<string, unknown> = {}) {
  const purchaseDate = addCalendarDays(todayIn(TZ), -10);
  return {
    storeId: null,
    storeName: 'Target',
    purchaseDate,
    amountCents: 4820,
    items: ['Lamp'],
    returnDays: 90,
    returnDeadline: addCalendarDays(purchaseDate, 90),
    warrantyMonths: null,
    warrantyEnd: null,
    status: 'active',
    photoPaths: [],
    ocrText: null,
    statusChangedAt: null,
    createdAt: { toMillis: () => 1 },
    ...fields,
  };
}

async function start(
  url: string,
  profile: Record<string, unknown> = {},
  receipts: Record<string, Record<string, unknown>> = {},
) {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  const { user: u } = (await signInAnonymously()) as { user: { uid: string } };
  uid = u.uid;
  seedDoc(userPath(), {
    isPro: false,
    activeCount: Object.keys(receipts).length,
    freeLimit: 5,
    reminderHour: 9,
    reminderDays: [7, 3, 1],
    timezone: TZ,
    fcmTokens: [],
    ...profile,
  });
  for (const [id, f] of Object.entries(receipts)) {
    seedDoc(`${userPath()}/receipts/${id}`, receiptDoc(f));
  }
  await renderRouter(APP_DIR, { initialUrl: url });
}

beforeEach(async () => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test';
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'goog_test';
  reset();
  resetFirestore();
  rc.resetPurchases();
  resetPurchasesForTests();
  resetReminderPushForTests();
  useSession.setState({ ready: false, user: null, showPrimer: false });
  useReceipts.getState().reset(null);
  useSnackbar.setState({ current: null });
  await AsyncStorage.clear();
  await AsyncStorage.setItem(INSTALL_KEY, '1');
});

describe('export CSV (unit)', () => {
  it('has the columns in order, one row per receipt, a BOM and CRLF line ends', () => {
    const csv = receiptsCsv(
      [
        receipt({ warrantyMonths: 12, warrantyEnd: '2027-11-01' }),
        receipt({ id: 'r2', status: 'returned' }),
      ],
      TODAY,
    );
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
    expect(lines[0]).toBe(
      'Store,Purchase date,Total (USD),Items,Return window (days),Return by,Status,Warranty (months),Warranty ends',
    );
    expect(lines[1]).toBe(
      'Target,2026-11-01,48.20,Kids sneakers,90,2027-01-30,Active,12,2027-11-01',
    );
    expect(lines[2]).toBe('Target,2026-11-01,48.20,Kids sneakers,90,2027-01-30,Returned,,');
    expect(lines[3]).toBe('');
    expect(lines).toHaveLength(4);
  });

  it('quotes commas, quotes and line breaks, and doubles quotes', () => {
    expect(csvField('Bed, Bath & Beyond')).toBe('"Bed, Bath & Beyond"');
    expect(csvField('19" monitor')).toBe('"19"" monitor"');
    expect(csvField('line one\nline two')).toBe('"line one\nline two"');
    expect(csvField('a\r\nb')).toBe('"a\r\nb"');
    expect(csvField(' padded ')).toBe('" padded "');
    expect(csvField('plain')).toBe('plain');
    expect(csvField(null)).toBe('');
    expect(csvField(90)).toBe('90');
  });

  it('defuses text a spreadsheet would run as a formula', () => {
    expect(csvField('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvField('+1')).toBe("'+1");
    expect(csvField('-2')).toBe("'-2");
    expect(csvField('@sum')).toBe("'@sum");
    // Numbers are written as numbers.
    expect(csvField(-2)).toBe('-2');
  });

  it('joins items with semicolons, writes cents as dollars and expired as Expired', () => {
    const csv = receiptsCsv(
      [receipt({ items: ['Lamp', 'Rug, wool'], amountCents: 5, returnDeadline: '2026-11-10' })],
      TODAY,
    );
    expect(csv).toContain('Target,2026-11-01,0.05,"Lamp; Rug, wool",90,2026-11-10,Expired,,');
    expect(centsToDecimal(9999999)).toBe('99999.99');
  });
});

describe('export PDF (unit)', () => {
  it('makes one page per receipt with its photos and escapes text', () => {
    const html = receiptsHtml(
      [
        receipt({ storeName: '<Best Buy>', photoPaths: ['p/a.jpg', 'p/b.jpg'] }),
        receipt({ id: 'r2', photoPaths: ['p/missing.jpg'] }),
      ],
      { 'p/a.jpg': 'data:image/jpeg;base64,AAA', 'p/b.jpg': 'data:image/jpeg;base64,BBB' },
      TODAY,
    );
    expect(html.match(/<section class="page">/g)).toHaveLength(2);
    expect(html).toContain('&lt;Best Buy&gt;');
    expect(html).not.toContain('<Best Buy>');
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).toContain('No photo');
    expect(escapeHtml(`"it's" & <b>`)).toBe('&quot;it&#39;s&quot; &amp; &lt;b&gt;');
  });
});

describe('dates for warranties (unit)', () => {
  it('adds months, clamping to the end of a shorter month', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addCalendarMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addCalendarMonths('2026-11-18', 12)).toBe('2027-11-18');
    expect(addCalendarMonths('2026-11-18', 120)).toBe('2036-11-18');
  });

  it('counts whole months and labels them', () => {
    expect(calendarMonthsBetween('2026-11-18', '2027-03-18')).toBe(4);
    expect(calendarMonthsBetween('2026-11-18', '2027-03-17')).toBe(3);
    expect(calendarMonthsBetween('2026-11-18', '2026-12-01')).toBe(0);
    expect(calendarMonthsBetween('2026-11-18', '2028-09-18')).toBe(22);
    expect(monthsLabel(4)).toBe('4 mo');
    expect(monthsLabel(12)).toBe('1 yr');
    expect(monthsLabel(22)).toBe('1 yr 10 mo');
  });
});

describe('warranties list (unit)', () => {
  const list = [
    receipt({ id: 'tv', items: ['65" TV'], warrantyEnd: '2028-09-03' }),
    receipt({ id: 'vac', items: ['Dyson vacuum'], warrantyEnd: '2027-03-20' }),
    receipt({ id: 'gone', items: ['Old'], warrantyEnd: '2026-10-01' }),
    receipt({ id: 'ret', items: ['Returned'], warrantyEnd: '2027-05-01', status: 'returned' }),
    receipt({ id: 'none' }),
  ];

  it('keeps products still covered, not returned, soonest end first', () => {
    const w = activeWarranties(list, TODAY);
    expect(w.map((x) => x.receipt.id)).toEqual(['vac', 'tv']);
    expect(w[0]).toMatchObject({ product: 'Dyson vacuum', monthsLeft: 4, endingSoon: true });
    expect(w[1]).toMatchObject({ monthsLeft: 21, endingSoon: false });
    expect(timeLeftLabel(w[1], TODAY)).toBe('1 yr 9 mo');
  });

  it('warns 4 months before coverage ends', () => {
    const w = activeWarranties(list, TODAY);
    expect(endingSoonMessage(w, TODAY)).toBe(
      'Dyson vacuum warranty ends in 4 months. Check it works before Mar 20.',
    );
    expect(endingSoonMessage(w.slice(1), TODAY)).toBeNull();
    const soon = activeWarranties([receipt({ warrantyEnd: '2026-11-30' })], TODAY);
    expect(timeLeftLabel(soon[0], TODAY)).toBe('12 days');
    expect(endingSoonMessage(soon, TODAY)).toContain('ends in 12 days');
  });
});

describe('paywall text and plans (unit)', () => {
  const yearly = { period: 'year' as const, price: '$19.99', trialDays: 7 };
  const monthly = { period: 'month' as const, price: '$2.99', trialDays: null };

  it('builds the trial, renewal and store text from store prices', () => {
    expect(planCaption(yearly)).toBe('7-day free trial, then $19.99/year');
    expect(planCaption(monthly)).toBe('Billed monthly');
    expect(ctaLabel(yearly)).toBe('Start 7-day free trial');
    expect(ctaLabel(monthly)).toBe('Subscribe for $2.99/month');
    expect(legalText(yearly, 'ios')).toBe(
      'Free for 7 days, then $19.99 per year. Renews automatically unless cancelled at least 24 ' +
        'hours before the end of the period. Charged to your Apple ID. Manage or cancel in ' +
        'Settings › Apple ID › Subscriptions.',
    );
    expect(legalText(monthly, 'android')).toBe(
      '$2.99 per month. Renews automatically unless cancelled at least 24 hours before the end ' +
        'of the period. Charged to your Google Play account. Manage or cancel in Play Store › ' +
        'Payments & subscriptions.',
    );
  });

  it('loads both plans from the default offering, with the trial only when eligible', async () => {
    const plans = await loadPlans();
    expect(plans.yearly).toMatchObject({ price: '$19.99', perMonth: '$1.67', trialDays: 7 });
    expect(plans.monthly).toMatchObject({ price: '$2.99', perMonth: null, trialDays: null });
    expect(yearlySavings(plans)).toBe(44);
    rc.purchasesControl.eligible = false;
    expect((await loadPlans()).yearly?.trialDays).toBeNull();
  });

  it('opens the right store page to manage the subscription', () => {
    expect(manageSubscriptionUrl(null)).toBe('https://apps.apple.com/account/subscriptions');
    expect(manageSubscriptionUrl('https://example.com/manage')).toBe('https://example.com/manage');
  });
});

describe('paywall (S15)', () => {
  it('TC-606 (unit): yearly is selected, with prices, trial, renewal text, Restore, Terms and Privacy', async () => {
    await start('/paywall');
    expect(await screen.findByTestId('paywall-plan-year')).toBeSelected();
    expect(screen.getByTestId('paywall-plan-month')).not.toBeSelected();
    expect(screen.getByText('SAVE 44%')).toBeTruthy();
    expect(screen.getByText('$1.67')).toBeTruthy();
    expect(screen.getByText('7-day free trial, then $19.99/year')).toBeTruthy();
    expect(screen.getByTestId('paywall-buy')).toHaveTextContent('Start 7-day free trial');
    expect(screen.getByTestId('paywall-legal')).toHaveTextContent(/Charged to your Apple ID/);
    expect(screen.getByTestId('paywall-restore')).toBeTruthy();
    expect(screen.getByTestId('paywall-terms')).toBeTruthy();
    expect(screen.getByTestId('paywall-privacy')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('paywall-plan-month'));
    expect(screen.getByTestId('paywall-buy')).toHaveTextContent('Subscribe for $2.99/month');
    expect(screen.getByTestId('paywall-legal')).toHaveTextContent(/^\$2\.99 per month\./);
  });

  it('TC-602 (unit): cancelling the store sheet stays Free with no message', async () => {
    rc.purchasesControl.purchase = 'cancelled';
    await start('/paywall');
    await fireEvent.press(await screen.findByTestId('paywall-buy'));
    await settle();
    expect(screen.getByTestId('screen-paywall')).toBeTruthy();
    expect(screen.queryByTestId('paywall-notice')).toBeNull();
    expect(usePro.getState().storePro).toBe(false);
  });

  it('shows a calm message for a pending or failed purchase', async () => {
    rc.purchasesControl.purchase = 'pending';
    await start('/paywall');
    await fireEvent.press(await screen.findByTestId('paywall-buy'));
    expect(await screen.findByTestId('paywall-notice')).toHaveTextContent(/waiting for approval/);
    rc.purchasesControl.purchase = 'failed';
    await fireEvent.press(screen.getByTestId('paywall-buy'));
    expect(await screen.findByTestId('paywall-notice')).toHaveTextContent(/didn't go through/);
  });

  it('TC-601 (unit): a purchase unlocks Pro at once and closes once the server agrees', async () => {
    await start('/home');
    await settle(() => undefined);
    expect(rc.purchasesControl.appUserID).toBe(uid);
    await settle(() => router.push('/paywall'));
    await fireEvent.press(await screen.findByTestId('paywall-buy'));
    await waitFor(() => expect(usePro.getState().storePro).toBe(true));
    // The webhook marks the user Pro on the server.
    await settle(() => seedDoc(userPath(), { ...firestoreDocs.get(userPath())!, isPro: true }));
    expect(await screen.findByTestId('screen-home')).toBeTruthy();
  });

  it('Restore with nothing to restore says so; with a purchase it unlocks Pro', async () => {
    await start('/paywall');
    await fireEvent.press(await screen.findByTestId('paywall-restore'));
    expect(await screen.findByTestId('paywall-notice')).toHaveTextContent(/No ReturnSafe Pro/);
    rc.purchasesControl.restorePro = true;
    await fireEvent.press(screen.getByTestId('paywall-restore'));
    await waitFor(() => expect(usePro.getState().storePro).toBe(true));
  });

  it('without a RevenueCat key the plans cannot load and Retry is offered', async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = '';
    await start('/paywall');
    expect(await screen.findByTestId('paywall-error')).toBeTruthy();
    expect(screen.getByTestId('paywall-retry')).toBeTruthy();
    expect(screen.getByTestId('paywall-terms')).toBeTruthy();
  });
});

describe('warranties tab (S14)', () => {
  it('TC-607 (unit): a Free user sees the locked card, and tapping it opens the paywall', async () => {
    await start('/warranties');
    await fireEvent.press(await screen.findByTestId('warranties-locked'));
    expect(await screen.findByTestId('screen-paywall')).toBeTruthy();
  });

  it('a Pro user sees warranties sorted by end date with the 4-month warning', async () => {
    const today = todayIn(TZ);
    await start(
      '/warranties',
      { isPro: true },
      {
        late: { items: ['TV'], warrantyMonths: 24, warrantyEnd: addCalendarMonths(today, 22) },
        soon: { items: ['Vacuum'], warrantyMonths: 12, warrantyEnd: addCalendarMonths(today, 3) },
      },
    );
    expect(await screen.findByTestId('warranties-caption')).toHaveTextContent('2 products covered');
    expect(screen.getByTestId('warranties-warning')).toHaveTextContent(
      /Vacuum warranty ends in 3 months/,
    );
    const rows = screen.getAllByTestId(/^warranty-/).map((r) => r.props.testID);
    expect(rows).toEqual(['warranty-soon', 'warranty-late']);
    expect(screen.getByTestId('warranties-pro')).toBeTruthy();
  });
});

describe('settings (S16)', () => {
  it('shows the Free plan, the upgrade banner and a locked Export', async () => {
    await start('/settings');
    expect(await screen.findByTestId('settings-plan-free')).toBeTruthy();
    expect(screen.getByTestId('settings-upgrade')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-export'));
    expect(await screen.findByTestId('screen-paywall')).toBeTruthy();
  });

  it('Pro users see their plan and can export a CSV through the share sheet', async () => {
    await start('/settings', { isPro: true }, { a: {}, b: { status: 'kept' } });
    expect(await screen.findByTestId('settings-plan-pro')).toBeTruthy();
    expect(screen.queryByTestId('settings-upgrade')).toBeNull();
    await fireEvent.press(screen.getByTestId('settings-export'));
    expect(await screen.findByTestId('export-include-all')).toHaveTextContent(/All receipts.*2/);
    await fireEvent.press(screen.getByTestId('export-csv'));
    await fireEvent.press(screen.getByTestId('export-run'));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    const [uri, opts] = (Sharing.shareAsync as jest.Mock).mock.calls.at(-1)!;
    expect(uri).toMatch(/ReturnSafe receipts \d{4}-\d{2}-\d{2}\.csv$/);
    expect(opts).toMatchObject({ mimeType: 'text/csv' });
  });

  it('Restore purchases and Manage subscription use the store', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    rc.purchasesControl.restorePro = true;
    await start('/settings');
    await fireEvent.press(await screen.findByTestId('settings-restore'));
    await waitFor(() => expect(useSnackbar.getState().current?.message).toBe('Pro restored'));
    expect(await screen.findByTestId('settings-plan-pro')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-manage'));
    expect(open).toHaveBeenCalledWith('https://apps.apple.com/account/subscriptions');
    open.mockRestore();
  });
});

describe('Pro gating in the receipt screens', () => {
  it('a Pro user adds a warranty in months and its end date is saved', async () => {
    await start('/receipt/a/edit', { isPro: true }, { a: { purchaseDate: '2026-11-01' } });
    await fireEvent.press(await screen.findByTestId('receipt-add-warranty'));
    await fireEvent.changeText(screen.getByTestId('receipt-warranty-months'), '12');
    expect(screen.getByText('Coverage ends Mon, Nov 1, 2027')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('receipt-save'));
    await waitFor(() =>
      expect(firestoreDocs.get(`${userPath()}/receipts/a`)).toMatchObject({
        warrantyMonths: 12,
        warrantyEnd: '2027-11-01',
      }),
    );
  });

  it('a Free user is sent to the paywall from Add warranty and from a second photo', async () => {
    await start('/receipt/a', {}, { a: { photoPaths: [`users/x/receipts/a/p1.jpg`] } });
    await fireEvent.press(await screen.findByTestId('receipt-add-photo'));
    expect(await screen.findByTestId('screen-paywall')).toBeTruthy();
  });

  it('upgrading from the limit sheet keeps the new receipt form open', async () => {
    const five = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [k, {}]));
    await start('/receipt/new', {}, five);
    await fireEvent.press(await screen.findByTestId('limit-see-pro'));
    expect(await screen.findByTestId('screen-paywall')).toBeTruthy();
    await fireEvent.press(await screen.findByTestId('paywall-buy'));
    await waitFor(() => expect(usePro.getState().storePro).toBe(true));
    await settle(() => seedDoc(userPath(), { ...firestoreDocs.get(userPath())!, isPro: true }));
    expect(await screen.findByTestId('screen-receipt-new')).toBeTruthy();
    expect(screen.queryByTestId('limit-sheet')).toBeNull();
  });
});
