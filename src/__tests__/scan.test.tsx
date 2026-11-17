import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';

import { useSnackbar } from '@/components/Snackbar';
import { useReceipts } from '@/features/receipts/receiptsStore';
import { flushStatus } from '@/features/receipts/statusActions';
import { useScanDraft } from '@/features/scan/scanDraft';
import { resetUploadsForTests, stopUploads } from '@/features/scan/uploadQueue';
import { todayIn } from '@/lib/dates';
import { INSTALL_KEY } from '@/lib/install';
import { ONBOARDING_KEY } from '@/lib/onboarding';
import { useSession } from '@/stores/session';
import { files, ocr, resetScan, setOcrText, storageState, uploads } from '@/test/fakeScan';
import { firestoreDocs, reset, resetFirestore, seedDoc, signInAnonymously } from '@/test/firebase';

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true, null],
  Inter_400Regular: 1,
  Inter_500Medium: 1,
  Inter_600SemiBold: 1,
  Inter_700Bold: 1,
  Inter_800ExtraBold: 1,
}));

const TZ = 'America/New_York';
const scanDocument = DocumentScanner.scanDocument as jest.Mock;
const getCameraPermissions = ImagePicker.getCameraPermissionsAsync as jest.Mock;
const requestCameraPermissions = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

const WALMART = [
  'Walmart',
  'Save money. Live better.',
  'ST# 01043 OP# 00009 TE# 09 TR# 07211',
  'AIR FRYER 5.8QT 068113112345 F 89.00 N',
  'SUBTOTAL 89.00',
  'TOTAL 89.00',
  'VISA TEND 89.00',
  '11/12/26 14:14:07',
].join('\n');

let uid = '';

async function start(url: string) {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  const { user } = (await signInAnonymously()) as { user: { uid: string } };
  uid = user.uid;
  seedDoc(`users/${uid}`, {
    isPro: false,
    activeCount: 0,
    freeLimit: 5,
    reminderHour: 9,
    reminderDays: [7, 3, 1],
    timezone: TZ,
  });
  await renderRouter('src/app', { initialUrl: url });
}

const scanReturns = (uri = 'file:///scan/page-1.jpg') =>
  scanDocument.mockResolvedValueOnce({ status: 'success', scannedImages: [uri] });

/** The one receipt saved for the user. */
function savedReceipt(): { id: string; data: Record<string, unknown> } {
  const prefix = `users/${uid}/receipts/`;
  const entries = [...firestoreDocs.entries()].filter(([p]) => p.startsWith(prefix));
  expect(entries).toHaveLength(1);
  const [path, data] = entries[0];
  return { id: path.slice(prefix.length), data: data as Record<string, unknown> };
}

beforeEach(async () => {
  reset();
  resetFirestore();
  resetScan();
  resetUploadsForTests();
  useSession.setState({ ready: false, user: null, showPrimer: false });
  useReceipts.getState().reset(null);
  useScanDraft.getState().clear();
  useSnackbar.setState({ current: null });
  await AsyncStorage.clear();
  await AsyncStorage.setItem(INSTALL_KEY, '1');
});

afterEach(() => {
  flushStatus();
  stopUploads();
});

describe('Scan (S09) and review (S10)', () => {
  it('a readable scan pre-fills the review with Detected badges and saves with its photo', async () => {
    setOcrText(WALMART);
    scanReturns();
    await start('/scanner');

    expect(await screen.findByTestId('screen-receipt-new')).toBeTruthy();
    expect(screen.getByTestId('scan-status')).toHaveTextContent('Receipt scanned');
    expect(screen.getByTestId('receipt-store')).toHaveTextContent(/Walmart/);
    expect(screen.getByLabelText('Store, Walmart, detected')).toBeTruthy();
    expect(screen.getByTestId('detected-store')).toBeTruthy();
    expect(screen.getByTestId('detected-date')).toBeTruthy();
    expect(screen.getByTestId('detected-total')).toBeTruthy();
    expect(screen.getByTestId('receipt-amount').props.value).toBe('89.00');
    expect(screen.getByTestId('receipt-date')).toHaveTextContent('Nov 12, 2026');
    expect(screen.getByTestId('receipt-items').props.value).toBe('AIR FRYER 5.8QT');
    // 90-day Walmart policy.
    expect(screen.getByTestId('receipt-deadline')).toHaveTextContent(/90-day Walmart policy/);
    expect(screen.getByTestId('receipt-deadline-date')).toHaveTextContent('Wed, Feb 10, 2027');

    await fireEvent.press(screen.getByTestId('receipt-save'));
    expect(await screen.findByTestId('screen-home')).toBeTruthy();

    const { id, data } = savedReceipt();
    const photos = data.photoPaths as string[];
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatch(new RegExp(`^users/${uid}/receipts/${id}/[A-Za-z0-9]{20}\\.jpg$`));
    expect(data).toMatchObject({ storeId: 'walmart', amountCents: 8900, returnDays: 90 });
    await waitFor(() => expect([...uploads.keys()]).toEqual(photos));
    expect(useScanDraft.getState().draft).toBeNull();
  });

  it('TC-404 (unit): a blank page says it could not be read and keeps the photo attached', async () => {
    setOcrText('');
    scanReturns();
    await start('/scanner');

    expect(await screen.findByTestId('scan-status')).toHaveTextContent(
      "We couldn't read this receipt",
    );
    // The photo shows once the image has loaded.
    await fireEvent(screen.getByTestId('scan-photo-loading'), 'load');
    expect(screen.getByTestId('scan-photo')).toBeTruthy();
    expect(screen.queryByTestId('detected-store')).toBeNull();
    expect(screen.queryByTestId('detected-total')).toBeNull();
    expect(screen.getByTestId('receipt-amount').props.value).toBe('');

    await fireEvent.press(screen.getByTestId('receipt-store'));
    await fireEvent.changeText(await screen.findByTestId('store-search'), 'target');
    await fireEvent.press(screen.getByTestId('store-option-target'));
    await fireEvent.changeText(screen.getByTestId('receipt-amount'), '20');
    await fireEvent.press(screen.getByTestId('receipt-save'));
    await screen.findByTestId('screen-home');

    expect((savedReceipt().data.photoPaths as string[])[0]).toMatch(/\.jpg$/);
  });

  it('text recognition failing is treated like an unreadable receipt', async () => {
    ocr.fail = true;
    scanReturns();
    await start('/scanner');
    expect(await screen.findByTestId('scan-status')).toHaveTextContent(
      "We couldn't read this receipt",
    );
  });

  it('a field the user changes loses its Detected badge', async () => {
    setOcrText(WALMART);
    scanReturns();
    await start('/scanner');
    await screen.findByTestId('detected-total');
    await fireEvent.changeText(screen.getByTestId('receipt-amount'), '79.00');
    expect(screen.queryByTestId('detected-total')).toBeNull();
    expect(screen.getByTestId('detected-store')).toBeTruthy();
  });

  it('closing the scanner leaves Scan again, Choose photo and Enter manually', async () => {
    await start('/scanner');
    expect(await screen.findByTestId('scanner-ready')).toBeTruthy();
    expect(screen.getByTestId('scanner-start')).toBeTruthy();

    setOcrText(WALMART);
    launchLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///library/photo.jpg' }],
    });
    await fireEvent.press(screen.getByTestId('scanner-library'));
    expect(await screen.findByTestId('detected-store')).toBeTruthy();
  });

  it('Enter manually opens the empty form', async () => {
    await start('/scanner');
    await fireEvent.press(await screen.findByTestId('scanner-enter-manually'));
    expect(await screen.findByTestId('screen-receipt-new')).toBeTruthy();
    expect(screen.queryByTestId('scan-summary')).toBeNull();
  });

  it('TC-403 (unit): camera denied shows the explanation, Open Settings and Enter manually', async () => {
    getCameraPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await start('/scanner');

    expect(await screen.findByTestId('scanner-denied')).toHaveTextContent(
      /ReturnSafe uses the camera to scan your receipts/,
    );
    expect(scanDocument).not.toHaveBeenCalled();
    expect(requestCameraPermissions).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('scanner-open-settings'));
    expect(openSettings).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('scanner-enter-manually'));
    expect(await screen.findByTestId('screen-receipt-new')).toBeTruthy();
  });

  it('asks for the camera the first time', async () => {
    getCameraPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    await start('/scanner');
    await screen.findByTestId('scanner-ready');
    expect(requestCameraPermissions).toHaveBeenCalled();
    expect(scanDocument).toHaveBeenCalledWith({
      maxNumDocuments: 1,
      croppedImageQuality: 100,
      responseType: 'imageFilePath',
    });
  });

  it('Retake drops the photo and opens the scanner again', async () => {
    setOcrText(WALMART);
    scanReturns();
    await start('/scanner');
    await screen.findByTestId('scan-summary');
    expect(files.size).toBe(1);
    await fireEvent.press(screen.getByTestId('scan-retake'));
    expect(await screen.findByTestId('scanner-ready')).toBeTruthy();
    expect(files.size).toBe(0);
  });

  it('an offline save keeps the photo queued and uploads it when back online', async () => {
    storageState.failNext = 1;
    setOcrText(WALMART);
    scanReturns();
    await start('/scanner');
    await screen.findByTestId('scan-summary');
    await fireEvent.press(screen.getByTestId('receipt-save'));
    await screen.findByTestId('screen-home');
    await waitFor(() => expect(storageState.putCalls).toHaveLength(1));
    expect(uploads.size).toBe(0);

    // Back online: the app comes to the foreground and the queue tries again.
    const { kickUploads } = jest.requireActual<typeof import('@/features/scan/uploadQueue')>(
      '@/features/scan/uploadQueue',
    );
    await act(async () => kickUploads());
    await waitFor(() => expect(uploads.size).toBe(1));
    expect(storageState.putCalls).toHaveLength(2);
  });

  it('deleting a receipt deletes its photo', async () => {
    setOcrText(WALMART);
    scanReturns();
    await start('/scanner');
    await screen.findByTestId('scan-summary');
    await fireEvent.press(screen.getByTestId('receipt-save'));
    await screen.findByTestId('screen-home');
    const { id, data } = savedReceipt();
    await waitFor(() => expect(uploads.size).toBe(1));

    const alert = jest.spyOn(Alert, 'alert');
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    await act(async () => router.push({ pathname: '/receipt/[id]', params: { id } }));
    await fireEvent(await screen.findByTestId('receipt-photo-loading'), 'load');
    expect(screen.getByTestId('receipt-photo')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('receipt-more'));
    await fireEvent.press(await screen.findByTestId('receipt-delete'));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'Delete')?.onPress?.());
    await waitFor(() => expect(uploads.has((data.photoPaths as string[])[0])).toBe(false));
  });

  it('uses the user’s today for future-date checks', () => {
    expect(todayIn(TZ)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
