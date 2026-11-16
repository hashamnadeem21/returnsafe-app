/**
 * Uploads receipt photos in the background. Jobs are saved on the device, so a photo taken offline
 * uploads once the app is back online, even after a restart. Each photo has a fixed Storage path
 * (its photoId never changes), so a retry overwrites the same file instead of adding a copy, and
 * a path that is already queued is never queued twice.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { putFile, ref } from '@react-native-firebase/storage';

import { storage } from '@/lib/firebase';

import { forgetLocalPhoto } from './photos';

export type UploadJob = {
  uid: string;
  receiptId: string;
  photoId: string;
  /** Storage path, users/{uid}/receipts/{receiptId}/{photoId}.jpg */
  path: string;
  /** The compressed photo on this device. */
  localUri: string;
  attempts: number;
};

export type Uploader = (job: UploadJob) => Promise<void>;

export const QUEUE_KEY = 'rs.uploadQueue';
const FIRST_RETRY_MS = 2_000;
const MAX_RETRY_MS = 5 * 60_000;

/** Wait before the next try: 2 s, 4 s, 8 s … up to 5 minutes. */
export function retryDelay(attempts: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** Math.max(0, attempts - 1), MAX_RETRY_MS);
}

const firebaseUploader: Uploader = async (job) => {
  const filePath = decodeURI(job.localUri.replace(/^file:\/\//, ''));
  await putFile(ref(storage(), job.path), filePath, { contentType: 'image/jpeg' });
};

let uploader: Uploader = firebaseUploader;
let jobs: UploadJob[] = [];
let loaded: Promise<void> | null = null;
let running = false;
let uid: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(QUEUE_KEY)
    .then((raw) => {
      const saved = raw ? (JSON.parse(raw) as UploadJob[]) : [];
      // Jobs queued while this one loaded stay; saved copies of the same path are dropped.
      jobs = [...saved.filter((s) => !jobs.some((j) => j.path === s.path)), ...jobs];
    })
    .catch(() => undefined);
  return loaded;
}

const save = () => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(jobs)).catch(() => undefined);

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

async function run(): Promise<void> {
  running = true;
  try {
    for (;;) {
      const job = jobs.find((j) => j.uid === uid);
      if (!job) return;
      try {
        await uploader(job);
        jobs = jobs.filter((j) => j.path !== job.path);
        await save();
        forgetLocalPhoto(job.photoId);
      } catch {
        // Offline or a passing error: try again later, starting with this same job.
        job.attempts += 1;
        await save();
        clearRetry();
        retryTimer = setTimeout(kickUploads, retryDelay(job.attempts));
        return;
      }
    }
  } finally {
    running = false;
  }
}

/** Starts (or restarts) uploading now, for example when the app comes back to the foreground. */
export function kickUploads(): void {
  clearRetry();
  if (running || !uid) return;
  void load().then(() => {
    if (!running && uid) void run();
  });
}

/** Uploads the signed-in user's queued photos from now on. */
export async function startUploads(forUid: string): Promise<void> {
  uid = forUid;
  await load();
  kickUploads();
}

/** Stops uploading (signed out). Queued jobs stay for when that user is back. */
export function stopUploads(): void {
  uid = null;
  clearRetry();
}

export async function enqueueUpload(job: Omit<UploadJob, 'attempts'>): Promise<void> {
  await load();
  if (jobs.some((j) => j.path === job.path)) return;
  jobs.push({ ...job, attempts: 0 });
  await save();
  kickUploads();
}

/** Drops a deleted receipt's uploads. */
export async function cancelUploads(receiptId: string): Promise<void> {
  await load();
  const dropped = jobs.filter((j) => j.receiptId === receiptId);
  if (dropped.length === 0) return;
  jobs = jobs.filter((j) => j.receiptId !== receiptId);
  await save();
  for (const j of dropped) forgetLocalPhoto(j.photoId);
}

/** The photo still waiting to upload for this Storage path, if any (shown from the device). */
export function queuedPhoto(path: string): UploadJob | undefined {
  return jobs.find((j) => j.path === path);
}

/** Test seam: swap the uploader and start from an empty, unloaded queue. */
export function resetUploadsForTests(next?: Uploader): void {
  uploader = next ?? firebaseUploader;
  jobs = [];
  loaded = null;
  running = false;
  uid = null;
  clearRetry();
}
