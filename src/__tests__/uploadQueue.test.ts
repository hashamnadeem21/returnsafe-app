import AsyncStorage from '@react-native-async-storage/async-storage';

import { textFromLines } from '@/features/scan/ocrLayout';
import { MAX_PHOTO_SIDE, newPhotoId, photoPath, preparePhoto } from '@/features/scan/photos';
import {
  cancelUploads,
  enqueueUpload,
  kickUploads,
  QUEUE_KEY,
  queuedPhoto,
  resetUploadsForTests,
  retryDelay,
  startUploads,
  stopUploads,
  subscribeUploads,
} from '@/features/scan/uploadQueue';
import { files, manipulated, resetScan, storageState, uploads } from '@/test/fakeScan';

const UID = 'u1';
const job = (n = 1) => ({
  uid: UID,
  receiptId: `r${n}`,
  photoId: `p${n}`,
  path: photoPath(UID, `r${n}`, `p${n}`),
  localUri: `file:///docs/receipt-photos/p${n}.jpg`,
});

/** Lets queued promise callbacks (uploads, saves) run. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(async () => {
  jest.useFakeTimers();
  resetScan();
  resetUploadsForTests();
  await AsyncStorage.clear();
});

afterEach(() => {
  stopUploads();
  jest.useRealTimers();
});

describe('upload queue', () => {
  it('uploads a queued photo to its fixed path as a JPEG and empties the queue', async () => {
    await startUploads(UID);
    await enqueueUpload(job());
    await settle();
    expect([...uploads.keys()]).toEqual(['users/u1/receipts/r1/p1.jpg']);
    expect(uploads.get('users/u1/receipts/r1/p1.jpg')).toEqual({
      filePath: '/docs/receipt-photos/p1.jpg',
      metadata: { contentType: 'image/jpeg' },
    });
    expect(JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]')).toEqual([]);
  });

  it('retries after failures with growing waits, then succeeds once', async () => {
    storageState.failNext = 2;
    await startUploads(UID);
    await enqueueUpload(job());
    await settle();
    expect(storageState.putCalls).toHaveLength(1);
    expect(uploads.size).toBe(0);

    await jest.advanceTimersByTimeAsync(retryDelay(1)); // 2 s
    expect(storageState.putCalls).toHaveLength(2);

    await jest.advanceTimersByTimeAsync(retryDelay(2) - 1); // 4 s, not yet
    expect(storageState.putCalls).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1);
    await settle();
    expect(storageState.putCalls).toHaveLength(3);
    expect(uploads.size).toBe(1);

    // Nothing left: no more tries.
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(storageState.putCalls).toHaveLength(3);
  });

  it('never queues the same photo twice, so it is uploaded once', async () => {
    storageState.failNext = 1;
    await startUploads(UID);
    await enqueueUpload(job());
    await settle();
    // Queued again while waiting to retry (e.g. saved twice): ignored.
    await enqueueUpload(job());
    await enqueueUpload(job());
    await jest.advanceTimersByTimeAsync(retryDelay(1));
    await settle();
    // One failed try and one successful one, both to the same path: one file in Storage.
    expect(storageState.putCalls).toEqual([job().path, job().path]);
    expect(uploads.size).toBe(1);
    expect(JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]')).toEqual([]);

    // Even a later upload of the same photo overwrites that file instead of adding one.
    await enqueueUpload(job());
    await settle();
    expect(uploads.size).toBe(1);
  });

  it('keeps jobs on the device while offline and uploads them after a restart', async () => {
    storageState.failNext = 1;
    await startUploads(UID);
    await enqueueUpload(job(1));
    await settle();
    expect(uploads.size).toBe(0);
    const saved = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]');
    expect(saved).toEqual([expect.objectContaining({ path: job(1).path, attempts: 1 })]);

    // App restarts: memory is gone, the saved queue is not.
    resetUploadsForTests();
    await startUploads(UID);
    await settle();
    expect([...uploads.keys()]).toEqual([job(1).path]);
  });

  it('tries again at once when the app comes back to the foreground', async () => {
    storageState.failNext = 1;
    await startUploads(UID);
    await enqueueUpload(job());
    await settle();
    kickUploads();
    await settle();
    expect(uploads.size).toBe(1);
  });

  it('waits for the owner to be signed in, and drops a deleted receipt’s photo', async () => {
    await enqueueUpload(job(1));
    await enqueueUpload(job(2));
    await settle();
    expect(storageState.putCalls).toHaveLength(0);
    expect(queuedPhoto(job(1).path)?.localUri).toBe(job(1).localUri);

    await cancelUploads('r1');
    await startUploads(UID);
    await settle();
    expect([...uploads.keys()]).toEqual([job(2).path]);
  });

  it('does not overwrite saved jobs when the saved queue could not be read', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([{ ...job(1), attempts: 3 }]));
    jest
      .mocked(AsyncStorage.getItem)
      .mockImplementationOnce(() => Promise.reject(new Error('disk')));
    await enqueueUpload(job(2));
    // Nothing written over the saved job while it could not be read.
    expect(JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]')).toEqual([
      expect.objectContaining({ path: job(1).path }),
    ]);

    // Next time the saved queue is read, both photos upload.
    await startUploads(UID);
    await settle();
    expect([...uploads.keys()].sort()).toEqual([job(1).path, job(2).path]);
    expect(JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]')).toEqual([]);
  });

  it('keeps the device photo until the queue without it is saved', async () => {
    files.add(job(1).localUri);
    await startUploads(UID);
    await enqueueUpload(job(1));
    jest
      .mocked(AsyncStorage.setItem)
      .mockImplementationOnce(() => Promise.reject(new Error('disk full')));
    await settle();
    expect(uploads.has(job(1).path)).toBe(true);
    // The saved queue still lists the job, so its photo must stay for a re-upload.
    expect(files.has(job(1).localUri)).toBe(true);

    await enqueueUpload(job(2));
    await settle();
    expect(files.has(job(1).localUri)).toBe(false);
  });

  it('retries a failed photo delete and treats a missing photo as deleted', async () => {
    await startUploads(UID);
    await enqueueUpload(job(1));
    await settle();
    storageState.failDeletes = 1;
    await cancelUploads('r1', UID, [job(1).path, photoPath(UID, 'r1', 'never-uploaded')]);
    await settle();
    expect(uploads.has(job(1).path)).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]')).toHaveLength(2);

    await jest.advanceTimersByTimeAsync(retryDelay(1));
    await settle();
    expect(uploads.has(job(1).path)).toBe(false);
    expect(JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]')).toEqual([]);
  });

  it('tells listeners when the saved queue is read', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([{ ...job(1), attempts: 1 }]));
    const listener = jest.fn();
    const unsubscribe = subscribeUploads(listener);
    expect(queuedPhoto(job(1).path)).toBeUndefined();
    await enqueueUpload(job(2));
    expect(listener).toHaveBeenCalled();
    expect(queuedPhoto(job(1).path)?.localUri).toBe(job(1).localUri);
    unsubscribe();
  });

  it('backs off up to five minutes', () => {
    expect([1, 2, 3, 4].map(retryDelay)).toEqual([2000, 4000, 8000, 16000]);
    expect(retryDelay(20)).toBe(5 * 60_000);
  });
});

describe('photos', () => {
  it('shrinks to 2000 px on the longest side as an 80% JPEG kept by photo id', async () => {
    const uri = await preparePhoto('file:///scan/page-1.jpg', 'abc');
    expect(manipulated.resizes).toEqual([{ height: MAX_PHOTO_SIDE }]);
    expect(manipulated.saves).toEqual([{ compress: 0.8, format: 'jpeg' }]);
    expect(uri).toBe('file:///docs/receipt-photos/abc.jpg');
    expect(files.has(uri)).toBe(true);
  });

  it('makes 20-character ids and owner-only paths', () => {
    expect(newPhotoId()).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(photoPath('u1', 'r1', 'p1')).toBe('users/u1/receipts/r1/p1.jpg');
  });
});

describe('OCR rows', () => {
  const line = (text: string, left: number, top: number) => ({
    text,
    frame: { left, top, right: left + 100, bottom: top + 18 },
  });

  it('puts label and amount columns back on the same row', () => {
    const labels = [line('SUBTOTAL', 10, 100), line('TOTAL', 10, 130)];
    const amounts = [line('89.00', 300, 102), line('95.23', 300, 131)];
    expect(textFromLines([...amounts, ...labels])).toBe('SUBTOTAL 89.00\nTOTAL 95.23');
  });

  it('keeps a large label and a smaller amount on one row', () => {
    const body = [0, 1, 2].map((i) => ({
      text: `LINE ${i}`,
      frame: { left: 10, top: i * 20, right: 110, bottom: i * 20 + 10 },
    }));
    const total = { text: 'TOTAL', frame: { left: 10, top: 100, right: 110, bottom: 140 } };
    const amount = { text: '89.00', frame: { left: 300, top: 120, right: 360, bottom: 140 } };
    expect(
      textFromLines([...body, amount, total])
        .split('\n')
        .pop(),
    ).toBe('TOTAL 89.00');
  });

  it('keeps rows in reading order', () => {
    expect(textFromLines([line('B', 10, 60), line('A', 10, 20)])).toBe('A\nB');
    expect(textFromLines([])).toBe('');
  });
});
