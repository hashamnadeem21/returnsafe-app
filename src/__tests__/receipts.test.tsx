import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { useSnackbar } from '@/components/Snackbar';
import { addCalendarDays, computeDeadline, isoToPickerDate, todayIn } from '@/lib/dates';
import { INSTALL_KEY } from '@/lib/install';
import { ONBOARDING_KEY } from '@/lib/onboarding';
import { flushStatus } from '@/features/receipts/statusActions';
import { useReceipts } from '@/features/receipts/receiptsStore';
import { useSession } from '@/stores/session';
import {
  firestoreDocs,
  firestoreWrites,
  reset,
  resetFirestore,
  seedDoc,
  setPending,
  signInAnonymously,
} from '@/test/firebase';

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
const today = () => todayIn(TZ);

type Seed = {
  id: string;
  store?: string;
  storeId?: string | null;
  daysAgo?: number;
  days?: number;
  cents?: number;
  status?: string;
  items?: string[];
};

let uid = '';

function receiptDoc(s: Seed) {
  const purchaseDate = addCalendarDays(today(), -(s.daysAgo ?? 0));
  const returnDays = s.days ?? 90;
  return {
    storeId: s.storeId === undefined ? 'target' : s.storeId,
    storeName: s.store ?? 'Target',
    purchaseDate,
    amountCents: s.cents ?? 4820,
    items: s.items ?? [],
    returnDays,
    returnDeadline: computeDeadline(purchaseDate, returnDays),
    warrantyMonths: null,
    warrantyEnd: null,
    status: s.status ?? 'active',
    photoPaths: [],
    ocrText: null,
    statusChangedAt: null,
    createdAt: { toMillis: () => 1 },
  };
}

async function start(url: string, receipts: Seed[] = [], profile: Record<string, unknown> = {}) {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  const { user } = (await signInAnonymously()) as { user: { uid: string } };
  uid = user.uid;
  seedDoc(`users/${uid}`, {
    isPro: false,
    activeCount: receipts.filter((r) => (r.status ?? 'active') === 'active').length,
    freeLimit: 5,
    reminderHour: 9,
    reminderDays: [7, 3, 1],
    timezone: TZ,
    ...profile,
  });
  for (const r of receipts) seedDoc(`users/${uid}/receipts/${r.id}`, receiptDoc(r));
  await renderRouter(APP_DIR, { initialUrl: url });
}

const receiptPath = (id: string) => `users/${uid}/receipts/${id}`;

async function chooseStore(query: string, optionTestId: string) {
  await fireEvent.press(screen.getByTestId('receipt-store'));
  await fireEvent.changeText(await screen.findByTestId('store-search'), query);
  await fireEvent.press(screen.getByTestId(optionTestId));
}

beforeEach(async () => {
  reset();
  resetFirestore();
  useSession.setState({ ready: false, user: null, showPrimer: false });
  useReceipts.getState().reset(null);
  useSnackbar.setState({ current: null });
  await AsyncStorage.clear();
  await AsyncStorage.setItem(INSTALL_KEY, '1');
});

afterEach(() => {
  flushStatus();
});

describe('Home', () => {
  it('shows the empty state with Scan and Enter manually', async () => {
    await start('/home');
    expect(await screen.findByTestId('home-empty')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-enter-manually'));
    expect(await screen.findByTestId('screen-receipt-new')).toBeTruthy();
  });

  it('splits receipts into Due soon and Later with money protected and saved', async () => {
    await start('/home', [
      { id: 'soon', daysAgo: 88, cents: 1000 },
      { id: 'later', store: 'Walmart', storeId: 'walmart', cents: 8900 },
      { id: 'back', store: 'Kohl’s', storeId: 'kohls', status: 'returned', cents: 5800 },
    ]);
    expect(await screen.findByTestId('home-due-soon')).toHaveTextContent(/Target.*2 days/);
    expect(screen.getByTestId('home-later')).toHaveTextContent(/Walmart.*90 days/);
    expect(screen.getByTestId('home-protected')).toHaveTextContent(/\$99\.00.*2 active receipts/);
    expect(screen.getByTestId('home-saved-amount')).toHaveTextContent('$58.00');
  });

  it('TC-312 (unit): a receipt only on this device shows Waiting to sync', async () => {
    await start('/home', [{ id: 'r1' }]);
    await act(async () => setPending(receiptPath('r1'), true));
    expect(await screen.findByTestId('receipt-pill-r1')).toHaveTextContent('Waiting to sync');
    await act(async () => setPending(receiptPath('r1'), false));
    expect(screen.getByTestId('receipt-pill-r1')).toHaveTextContent('90 days');
  });
});

describe('Receipt form', () => {
  it('TC-307 (unit): Target, today, $48.20 appears on Home with 90 days left', async () => {
    await start('/receipt/new');
    await chooseStore('Tar', 'store-option-target');
    expect(screen.getByTestId('receipt-deadline')).toHaveTextContent(/90-day Target policy/);
    await fireEvent.changeText(screen.getByTestId('receipt-amount'), '48.20');
    await fireEvent.press(screen.getByTestId('receipt-save'));

    expect(await screen.findByTestId('screen-home')).toBeTruthy();
    const saved = [...firestoreDocs.entries()].find(([p]) =>
      p.startsWith(`users/${uid}/receipts/`),
    );
    expect(saved?.[1]).toMatchObject({
      storeId: 'target',
      storeName: 'Target',
      purchaseDate: today(),
      amountCents: 4820,
      returnDays: 90,
      returnDeadline: computeDeadline(today(), 90),
      status: 'active',
    });
    expect(await screen.findByTestId('home-later')).toHaveTextContent(/Target.*\$48\.20.*90 days/);
  });

  it('TC-313 (unit): a future date and a zero amount are blocked with inline errors', async () => {
    await start('/receipt/new');
    await chooseStore('Target', 'store-option-target');
    await fireEvent.press(screen.getByTestId('receipt-date'));
    const tomorrow = isoToPickerDate(addCalendarDays(today(), 1));
    await fireEvent(await screen.findByTestId('date-picker'), 'change', { type: 'set' }, tomorrow);
    await fireEvent.press(screen.getByTestId('date-done'));
    await fireEvent.changeText(screen.getByTestId('receipt-amount'), '0');
    await fireEvent.press(screen.getByTestId('receipt-save'));

    expect(await screen.findByText("The purchase date can't be in the future")).toBeTruthy();
    expect(screen.getByText('Enter an amount from $0.01 to $99,999.99')).toBeTruthy();
    expect(firestoreWrites).toHaveLength(0);
  });

  it('TC-308 (unit): editing the date to 80 days ago leaves 10 days', async () => {
    await start('/receipt/r1/edit', [{ id: 'r1' }]);
    await fireEvent.press(await screen.findByTestId('receipt-date'));
    const past = isoToPickerDate(addCalendarDays(today(), -80));
    await fireEvent(await screen.findByTestId('date-picker'), 'change', { type: 'set' }, past);
    await fireEvent.press(screen.getByTestId('date-done'));
    await fireEvent.press(screen.getByTestId('receipt-save'));

    await waitFor(() =>
      expect(firestoreDocs.get(receiptPath('r1'))).toMatchObject({
        purchaseDate: addCalendarDays(today(), -80),
        returnDeadline: addCalendarDays(today(), 10),
      }),
    );
    await act(async () => router.replace('/home'));
    expect(await screen.findByTestId('receipt-pill-r1')).toHaveTextContent('10 days');
  });

  it('TC-314 (unit): a new store remembers its window for next time', async () => {
    await start('/receipt/new');
    await chooseStore("Joe's Bikes", 'store-add-new');
    await fireEvent.press(await screen.findByTestId('window-14', {}, { timeout: 2000 }));
    await fireEvent.press(screen.getByTestId('window-save'));
    await fireEvent.changeText(screen.getByTestId('receipt-amount'), '120');
    await fireEvent.press(screen.getByTestId('receipt-save'));
    expect(await screen.findByTestId('screen-home')).toBeTruthy();
    expect(firestoreDocs.get(`users/${uid}/customStores/joesbikes`)).toMatchObject({
      name: "Joe's Bikes",
      returnDays: 14,
    });

    await act(async () => router.push('/receipt/new'));
    await chooseStore('joes', 'store-option-custom-joesbikes');
    expect(screen.getByTestId('receipt-deadline')).toHaveTextContent(/14-day return window/);
    expect(screen.queryByTestId('window-save')).toBeNull();
  });

  it('TC-306 (unit): a free user with 5 active receipts sees the limit sheet', async () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    await start('/receipt/new', five);
    expect(await screen.findByTestId('limit-sheet')).toHaveTextContent(/5 of 5 active/);
    await fireEvent.press(screen.getByTestId('limit-see-pro'));
    expect(await screen.findByTestId('screen-paywall')).toBeTruthy();
  });
});

describe('Receipt detail', () => {
  it('TC-309 (unit): Undo within 5 s puts it back without saving anything', async () => {
    await start('/home', [{ id: 'r1' }]);
    await fireEvent.press(await screen.findByTestId('receipt-row-r1'));
    await fireEvent.press(await screen.findByTestId('receipt-returned'));
    expect(screen.getByTestId('snackbar')).toHaveTextContent(/Marked as returned/);
    expect(screen.queryByTestId('receipt-returned')).toBeNull();
    await fireEvent.press(screen.getByTestId('snackbar-action'));

    expect(await screen.findByTestId('receipt-returned')).toBeTruthy();
    await act(async () => flushStatus());
    expect(firestoreWrites.filter((w) => w.path === receiptPath('r1'))).toHaveLength(0);
    expect(firestoreDocs.get(receiptPath('r1'))).toMatchObject({ status: 'active' });
  });

  it('TC-310 (unit): after 5 s it is saved as returned and money saved goes up', async () => {
    await start('/home', [{ id: 'r1' }]);
    await fireEvent.press(await screen.findByTestId('receipt-row-r1'));
    await fireEvent.press(await screen.findByTestId('receipt-returned'));
    // The 5-second window ending (timing itself is covered in statusActions.test.ts).
    await act(async () => flushStatus());

    expect(firestoreDocs.get(receiptPath('r1'))).toMatchObject({ status: 'returned' });
    await fireEvent.press(screen.getByTestId('header-back'));
    expect(await screen.findByTestId('home-saved-amount')).toHaveTextContent('$48.20');
  });

  it('Keep it marks the receipt kept', async () => {
    await start('/receipt/r1', [{ id: 'r1' }]);
    await fireEvent.press(await screen.findByTestId('receipt-keep'));
    await act(async () => flushStatus());
    expect(firestoreDocs.get(receiptPath('r1'))).toMatchObject({ status: 'kept' });
  });

  it('Delete asks first, then removes the receipt', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await start('/receipt/r1', [{ id: 'r1', items: ['Kids sneakers'] }]);
    expect(await screen.findByText('Kids sneakers')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('receipt-more'));
    await fireEvent.press(await screen.findByTestId('receipt-delete'));
    expect(firestoreDocs.has(receiptPath('r1'))).toBe(true);
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((b) => b.style === 'destructive')?.onPress?.());
    expect(firestoreDocs.has(receiptPath('r1'))).toBe(false);
    alert.mockRestore();
  });
});

describe('Receipts list', () => {
  it('TC-311 (unit): searching "tar" shows only Target receipts', async () => {
    await start('/receipts', [
      { id: 't1' },
      { id: 'w1', store: 'Walmart', storeId: 'walmart' },
      { id: 't2', daysAgo: 10, status: 'returned' },
    ]);
    expect(await screen.findByTestId('receipt-row-w1')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('receipts-search'), 'tar');
    await waitFor(() => expect(screen.queryByTestId('receipt-row-w1')).toBeNull());
    expect(screen.getByTestId('receipt-row-t1')).toBeTruthy();
    expect(screen.getByTestId('receipt-row-t2')).toBeTruthy();
  });

  it('filter chips show counts and narrow the list', async () => {
    await start('/receipts', [
      { id: 't1' },
      { id: 'k1', store: 'Kohl’s', storeId: 'kohls', status: 'kept' },
    ]);
    expect(await screen.findByTestId('filter-all')).toHaveTextContent(/All.*2/);
    expect(screen.getByTestId('filter-kept')).toHaveTextContent(/Kept.*1/);
    await fireEvent.press(screen.getByTestId('filter-kept'));
    await waitFor(() => expect(screen.queryByTestId('receipt-row-t1')).toBeNull());
    expect(screen.getByTestId('receipt-row-k1')).toBeTruthy();
  });
});
