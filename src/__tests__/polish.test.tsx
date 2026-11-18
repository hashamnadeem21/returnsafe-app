/**
 * Phase 7 polish: dark mode and accessibility audits of every screen, contrast of the colour
 * tokens, offline and loading states, spoken countdowns and the analytics events.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking, StyleSheet } from 'react-native';

import { useSnackbar } from '@/components/Snackbar';
import { spokenStatus } from '@/features/receipts/components/ReceiptRow';
import { useReceipts } from '@/features/receipts/receiptsStore';
import type { Receipt } from '@/features/receipts/types';
import { resetReminderPushForTests } from '@/features/reminders/ReminderPush';
import { resetPurchasesForTests } from '@/features/subscription/purchases';
import { addCalendarDays, todayIn } from '@/lib/dates';
import { INSTALL_KEY } from '@/lib/install';
import { isOnline, useNetwork } from '@/lib/network';
import { ONBOARDING_KEY } from '@/lib/onboarding';
import {
  paywallSource,
  reportError,
  startTelemetry,
  track,
  type TelemetryEvent,
} from '@/lib/telemetry';
import { useSession } from '@/stores/session';
import { firestoreDocs, reset, resetFirestore, seedDoc, signInAnonymously } from '@/test/firebase';
import {
  avatarColors,
  avatarFallback,
  googleLogoColors,
  palettes,
  type ColorScheme,
} from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const net = require('@/test/fakeNetInfo') as {
  setConnection: (connected: boolean, reachable?: boolean) => void;
  resetNetInfo: () => void;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const analytics = require('@react-native-firebase/analytics') as {
  __events: Record<string, unknown>[];
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crashlytics = require('@react-native-firebase/crashlytics') as {
  recordError: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rc = require('@/test/fakePurchases') as { resetPurchases: () => void };

let mockScheme: ColorScheme = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockScheme,
}));

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
let uid = '';

function receiptDoc(fields: Record<string, unknown> = {}) {
  const purchaseDate = addCalendarDays(todayIn(TZ), -10);
  return {
    storeId: null,
    storeName: 'Target',
    purchaseDate,
    amountCents: 4820,
    items: ['Lamp'],
    returnDays: 30,
    returnDeadline: addCalendarDays(purchaseDate, 30),
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

async function settle(fn: () => void = () => undefined) {
  await act(async () => {
    fn();
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}

/** Signs in, seeds the profile and receipts, and opens `url`. */
async function start(
  url: string,
  profile: Record<string, unknown> = {},
  receipts: Record<string, Record<string, unknown>> = {},
) {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  const { user } = (await signInAnonymously()) as { user: { uid: string } };
  uid = user.uid;
  seedDoc(`users/${uid}`, {
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
    seedDoc(`users/${uid}/receipts/${id}`, receiptDoc(f));
  }
  await renderRouter(APP_DIR, { initialUrl: url });
  await settle();
}

beforeEach(async () => {
  mockScheme = 'light';
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test';
  reset();
  resetFirestore();
  rc.resetPurchases();
  resetPurchasesForTests();
  resetReminderPushForTests();
  net.resetNetInfo();
  useNetwork.setState({ online: true });
  useSession.setState({ ready: false, user: null, showPrimer: false });
  useReceipts.getState().reset(null);
  useSnackbar.setState({ current: null });
  analytics.__events.length = 0;
  crashlytics.recordError.mockClear();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(INSTALL_KEY, '1');
  await startTelemetry(false);
});

// ---------- tree helpers ----------

type Node = {
  type: string;
  props: Record<string, unknown>;
  children: (Node | string)[] | null;
};

function nodes(): Node[] {
  const out: Node[] = [];
  const walk = (n: Node | Node[] | string | null) => {
    if (!n || typeof n === 'string') return;
    if (Array.isArray(n)) return n.forEach(walk);
    out.push(n);
    n.children?.forEach(walk);
  };
  walk(screen.toJSON() as Node | Node[] | null);
  return out;
}

function textOf(n: Node | string): string {
  if (typeof n === 'string') return n;
  return (n.children ?? []).map(textOf).join('');
}

const COLOR_PROPS = [
  'color',
  'fill',
  'stroke',
  'placeholderTextColor',
  'selectionColor',
  'tintColor',
];

/** Every colour a rendered screen uses: in styles, and in colour props of icons and inputs. */
function colorsUsed(): Set<string> {
  const used = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'string' && v !== 'none' && v !== 'currentColor') used.add(v.toUpperCase());
  };
  for (const n of nodes()) {
    const style = StyleSheet.flatten(n.props.style as never) as Record<string, unknown> | undefined;
    for (const [k, v] of Object.entries(style ?? {})) if (/colou?r$/i.test(k)) add(v);
    for (const k of COLOR_PROPS) add(n.props[k]);
  }
  return used;
}

/** Colours allowed in dark mode: the dark palette and the fixed brand colours both themes share. */
const DARK_ALLOWED = new Set(
  [
    ...Object.values(palettes.dark),
    ...Object.values(avatarColors).flat(),
    ...avatarFallback,
    ...Object.values(googleLogoColors),
    'transparent',
  ].map((c) => c.toUpperCase()),
);

/** Pressable things that a screen reader can't name or doesn't know are buttons. */
function unlabelledControls(): string[] {
  const bad: string[] = [];
  for (const n of nodes()) {
    if (typeof n.props.onPress !== 'function' || n.props.accessible === false) continue;
    const label =
      (typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel) ||
      textOf(n).trim();
    const role = n.props.accessibilityRole ?? n.props.role;
    if (!label || !role) bad.push(`${String(n.props.testID ?? n.type)} (role ${String(role)})`);
  }
  return bad;
}

// Screens the audits cover, with the data each needs.
const RECEIPTS = {
  r1: { storeName: 'Target' },
  r2: { storeName: 'Best Buy', status: 'returned', statusChangedAt: { toMillis: () => 2 } },
  w1: { storeName: 'Apple', warrantyMonths: 12, warrantyEnd: '2027-06-01' },
};
const SIGNED_IN: [string, Record<string, unknown>][] = [
  ['/home', {}],
  ['/receipts', {}],
  ['/warranties', {}],
  ['/warranties', { isPro: true }],
  ['/settings', {}],
  ['/settings', { isPro: true }],
  ['/receipt/r1', {}],
  ['/receipt/r1/edit', {}],
  ['/receipt/new', {}],
  ['/paywall', {}],
  ['/settings/reminders', {}],
  ['/settings/account', {}],
  ['/settings/delete-account', {}],
  ['/notification-primer', {}],
];
const SIGNED_OUT = ['/welcome', '/log-in', '/sign-up', '/forgot-password'];

async function openSignedOut(url: string) {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  await renderRouter(APP_DIR, { initialUrl: url });
  await settle();
}

describe('dark mode audit', () => {
  it.each(SIGNED_IN)('%s uses only dark colours (%j)', async (url, profile) => {
    mockScheme = 'dark';
    await start(url, profile, RECEIPTS);
    const off = [...colorsUsed()].filter((c) => !DARK_ALLOWED.has(c));
    expect(off).toEqual([]);
  });

  it.each(SIGNED_OUT)('%s uses only dark colours', async (url) => {
    mockScheme = 'dark';
    await openSignedOut(url);
    const off = [...colorsUsed()].filter((c) => !DARK_ALLOWED.has(c));
    expect(off).toEqual([]);
  });

  it('the offline banner and onboarding also use dark colours', async () => {
    mockScheme = 'dark';
    await renderRouter(APP_DIR, { initialUrl: '/onboarding' });
    await settle();
    expect([...colorsUsed()].filter((c) => !DARK_ALLOWED.has(c))).toEqual([]);
  });
});

describe('accessibility audit', () => {
  it.each(SIGNED_IN)('%s: every control has a role and a label (%j)', async (url, profile) => {
    await start(url, profile, RECEIPTS);
    expect(unlabelledControls()).toEqual([]);
  });

  it.each(SIGNED_OUT)('%s: every control has a role and a label', async (url) => {
    await openSignedOut(url);
    expect(unlabelledControls()).toEqual([]);
  });
});

/** WCAG relative luminance contrast of two #RRGGBB colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast (WCAG AA)', () => {
  it.each(['light', 'dark'] as const)('text colours on their backgrounds, %s', (s) => {
    const c = palettes[s];
    // Normal text needs 4.5:1.
    const text: [string, string, string][] = [
      ['ink on bg', c.ink, c.bg],
      ['ink on surface', c.ink, c.surface],
      ['ink2 on bg', c.ink2, c.bg],
      ['ink2 on surface', c.ink2, c.surface],
      ['button text', c.onPrimary, c.primary],
      ['warn banner', c.bannerWarnText, c.warningSoft],
      ['info banner', c.bannerInfoText, c.primarySoft],
      ['offline banner', c.bannerOfflineText, c.bannerOfflineBg],
      ['amber pill', c.warningText, c.warningSoft],
      ['red pill', c.dangerText, c.dangerSoft],
      ['green pill', c.successText, c.successSoft],
      ['placeholder on surface', c.placeholder, c.surface],
      ['placeholder on bg', c.placeholder, c.bg],
      ['grey pill', c.ink2, c.bg],
      ['teal pill', s === 'dark' ? c.primary : c.primaryPressed, c.primarySoft],
    ];
    // Icons, borders of inputs and large text need 3:1.
    const ui: [string, string, string][] = [['primary on surface', c.primary, c.surface]];
    const fails = [
      ...text.filter(([, f, b]) => contrast(f, b) < 4.5),
      ...ui.filter(([, f, b]) => contrast(f, b) < 3),
    ].map(([name, f, b]) => `${name} ${contrast(f, b).toFixed(2)}`);
    expect(fails).toEqual([]);
  });

  it('letter avatars are readable', () => {
    for (const [bg, fg] of [...Object.values(avatarColors), avatarFallback]) {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('spoken countdown', () => {
  const r = (f: Partial<Receipt>): Receipt => ({
    id: 'x',
    storeId: null,
    storeName: 'Target',
    purchaseDate: '2026-11-01',
    amountCents: 100,
    items: [],
    returnDays: 30,
    returnDeadline: '2026-11-20',
    warrantyMonths: null,
    warrantyEnd: null,
    status: 'active',
    photoPaths: [],
    createdAt: 1,
    statusChangedAt: null,
    pending: false,
    ...f,
  });

  it('says days left as a sentence', () => {
    expect(spokenStatus(r({}), '2026-11-18')).toBe('2 days left to return Target receipt');
    expect(spokenStatus(r({}), '2026-11-19')).toBe('1 day left to return Target receipt');
    expect(spokenStatus(r({}), '2026-11-20')).toBe('Last day to return Target receipt');
    expect(spokenStatus(r({ status: 'returned' }), '2026-11-18')).toBe('Target receipt, returned');
    expect(spokenStatus(r({}), '2026-11-21')).toBe('Target receipt, expired');
    expect(spokenStatus(r({ pending: true }), '2026-11-18')).toBe(
      'Target receipt, waiting to sync',
    );
  });

  it('rows and the detail ring use it', async () => {
    await start('/home', {}, { r1: {} });
    const row = await screen.findByTestId('receipt-row-r1');
    expect(row.props.accessibilityLabel).toMatch(/^20 days left to return Target receipt\. /);
    await fireEvent.press(row);
    expect((await screen.findByTestId('receipt-ring')).props.accessibilityLabel).toBe(
      '20 days left to return Target receipt',
    );
  });
});

describe('offline, loading and error states', () => {
  it('counts unknown reachability as online', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it.each(['/home', '/receipts', '/warranties', '/receipt/r1'])(
    '%s shows the offline banner while offline',
    async (url) => {
      await start(url, { isPro: true }, { r1: {} });
      expect(screen.queryByTestId('offline-banner')).toBeNull();
      await settle(() => net.setConnection(false));
      expect(await screen.findByTestId('offline-banner')).toHaveTextContent(
        "You're offline. Changes are saved and will sync when you're back online.",
      );
      await settle(() => net.setConnection(true));
      await waitFor(() => expect(screen.queryByTestId('offline-banner')).toBeNull());
    },
  );

  it('a receipt opened before the list loads shows a skeleton, then the receipt', async () => {
    await start('/home', {}, { r1: {} });
    await settle(() => useReceipts.setState({ loaded: false, receipts: [] }));
    await settle(() => router().push('/receipt/r1'));
    expect(await screen.findByTestId('receipts-loading')).toBeTruthy();
    expect(screen.queryByText('Receipt not found')).toBeNull();
    await settle(() => useReceipts.setState({ error: true, loaded: true }));
    expect(await screen.findByTestId('receipts-retry')).toBeTruthy();
  });

  it('every list shows Retry when receipts fail to load', async () => {
    await start('/receipts', {}, { r1: {} });
    await settle(() => useReceipts.getState().setError(true));
    await fireEvent.press(await screen.findByTestId('receipts-retry'));
    expect(useReceipts.getState().error).toBe(false);
  });
});

describe('settings help, legal and version', () => {
  it('opens the support and privacy pages and shows the build', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await start('/settings');
    expect(screen.getByTestId('settings-version')).toHaveTextContent('Version 1.0.0 (7)');
    expect(screen.getByTestId('settings-help').props.accessibilityRole).toBe('link');
    await fireEvent.press(screen.getByTestId('settings-help'));
    expect(open).toHaveBeenLastCalledWith('https://getreturnsafe.com/support');
    await fireEvent.press(screen.getByTestId('settings-privacy'));
    expect(open).toHaveBeenLastCalledWith('https://getreturnsafe.com/privacy');
    open.mockRestore();
  });

  it('says so when a page cannot open', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no browser'));
    await start('/settings');
    await settle(() => fireEvent.press(screen.getByTestId('settings-help')));
    expect(useSnackbar.getState().current?.message).toBe("Couldn't open the page. Try again.");
    open.mockRestore();
  });
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const router = () => (require('expo-router') as typeof import('expo-router')).router;

describe('analytics and crash reports', () => {
  /** Parameters an event may carry. Anything else (names, stores, amounts, ids) is personal. */
  const ALLOWED_PARAMS = new Set(['name', 'method', 'source', 'plan']);

  it('sends nothing until telemetry is on, and only fixed values', async () => {
    track({ name: 'receipt_returned' });
    reportError(new Error('x'), 'test');
    expect(analytics.__events).toEqual([]);
    expect(crashlytics.recordError).not.toHaveBeenCalled();

    await startTelemetry(true);
    const all: TelemetryEvent[] = [
      { name: 'onboarding_complete' },
      { name: 'sign_up', method: 'email' },
      { name: 'receipt_added', source: 'scan' },
      { name: 'receipt_returned' },
      { name: 'paywall_view', source: 'limit' },
      { name: 'purchase_start', plan: 'year' },
      { name: 'purchase_success', plan: 'month' },
    ];
    all.forEach(track);
    await settle();
    expect(analytics.__events).toEqual(all);
    reportError('boom', 'test');
    expect(crashlytics.recordError).toHaveBeenCalledWith({}, expect.any(Error), 'test');
  });

  it('unknown paywall sources are reported as "other"', () => {
    expect(paywallSource('limit')).toBe('limit');
    expect(paywallSource('evil@example.com')).toBe('other');
    expect(paywallSource(undefined)).toBe('other');
  });

  it('the app sends the funnel events with no personal data', async () => {
    await startTelemetry(true);
    await start('/receipt/new', {}, {});
    await fireEvent.press(await screen.findByTestId('receipt-store'));
    await fireEvent.changeText(await screen.findByTestId('store-search'), 'Target');
    await fireEvent.press(screen.getByTestId('store-option-target'));
    await fireEvent.changeText(screen.getByTestId('receipt-amount'), '48.20');
    await fireEvent.press(screen.getByTestId('receipt-save'));
    await waitFor(() =>
      expect(analytics.__events).toContainEqual({ name: 'receipt_added', source: 'manual' }),
    );

    await settle(() => router().push({ pathname: '/paywall', params: { from: 'settings' } }));
    await waitFor(() =>
      expect(analytics.__events).toContainEqual({ name: 'paywall_view', source: 'settings' }),
    );
    await fireEvent.press(await screen.findByTestId('paywall-buy'));
    await waitFor(() =>
      expect(analytics.__events).toContainEqual({ name: 'purchase_success', plan: 'year' }),
    );
    expect(analytics.__events).toContainEqual({ name: 'purchase_start', plan: 'year' });

    for (const e of analytics.__events) {
      expect(Object.keys(e).filter((k) => !ALLOWED_PARAMS.has(k))).toEqual([]);
      expect(JSON.stringify(e)).not.toMatch(/Target|48|@|users\//);
    }
    expect(firestoreDocs.size).toBeGreaterThan(0);
  });
});
