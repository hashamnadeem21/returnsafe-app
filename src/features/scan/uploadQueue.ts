/**
 * Uploads receipt photos in the background, and deletes the photos of deleted receipts. Jobs are
 * saved on the device, so a photo taken offline uploads once the app is back online, even after a
 * restart. Each photo has a fixed Storage path (its photoId never changes), so a retry overwrites
 * the same file instead of adding a copy, and a path that is already queued is never queued twice.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteObject, putFile, ref } from '@react-native-firebase/storage';

import { storage } from '@/lib/firebase';

import { forgetLocalPhoto } from './photos';

export type UploadJob = {
  /** 'delete' removes the photo of a deleted receipt; uploads have no kind (older saved jobs too). */
  kind?: 'delete';
  uid: string;
  receiptId: string;
  photoId: string;
  /** Storage path, users/{uid}/receipts/{receiptId}/{photoId}.jpg */
  path: string;
  /** The compressed photo on this device ('' for a delete). */
  localUri: string;
  attempts: number;
};

export type Uploader = (job: UploadJob) => Promise<void>;
export type Remover = (path: string) => Promise<void>;

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

const firebaseRemover: Remover = async (path) => {
  try {
    await deleteObject(ref(storage(), path));
  } catch (e) {
    // Already gone (or never uploaded): nothing left to clean up.
    if ((e as { code?: string }).code !== 'storage/object-not-found') throw e;
  }
};

let uploader: Uploader = firebaseUploader;
let remover: Remover = firebaseRemover;
let jobs: UploadJob[] = [];
let loaded: Promise<void> | null = null;
/** True once the saved queue was read; until then nothing is written, so no saved job is lost. */
let restored = false;
let running = false;
let uid: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
/** Device photos to delete once the queue without their jobs is saved. */
let toForget: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Called whenever the queue changes (restored, job added, uploaded or dropped). */
export function subscribeUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(QUEUE_KEY).then(
    async (raw) => {
      const saved = raw ? (JSON.parse(raw) as UploadJob[]) : [];
      // Jobs queued while this one loaded stay; saved copies of the same path are dropped.
      const queuedMeanwhile = jobs.length > 0;
      jobs = [...saved.filter((s) => !jobs.some((j) => j.path === s.path)), ...jobs];
      restored = true;
      if (queuedMeanwhile) await save();
      notify();
    },
    () => {
      // Could not read the saved queue: try again next time, and keep new jobs in memory only.
      loaded = null;
    },
  );
  return loaded;
}

/** Saves the queue. False when it could not be saved (or the saved queue is not read yet). */
async function save(): Promise<boolean> {
  if (!restored) return false;
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(jobs));
  } catch {
    return false;
  }
  // The saved queue no longer lists these photos, so their device copies can go.
  for (const id of toForget) forgetLocalPhoto(id);
  toForget = [];
  return true;
}

/** Drops jobs, and their device photos once that is saved. */
async function drop(done: (j: UploadJob) => boolean): Promise<void> {
  const gone = jobs.filter(done);
  if (gone.length === 0) return;
  jobs = jobs.filter((j) => !done(j));
  toForget.push(...gone.filter((j) => !j.kind).map((j) => j.photoId));
  await save();
  notify();
}

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
        if (job.kind === 'delete') await remover(job.path);
        else await uploader(job);
        await drop((j) => j === job);
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

export async function enqueueUpload(job: Omit<UploadJob, 'attempts' | 'kind'>): Promise<void> {
  await load();
  if (jobs.some((j) => j.path === job.path)) return;
  jobs.push({ ...job, attempts: 0 });
  await save();
  notify();
  kickUploads();
}

/**
 * Drops a deleted receipt's uploads and queues its photos for deletion, so a delete that fails
 * offline is tried again later instead of leaving the photo behind.
 */
export async function cancelUploads(
  receiptId: string,
  owner?: string,
  photoPaths: readonly string[] = [],
): Promise<void> {
  await load();
  await drop((j) => j.receiptId === receiptId && !j.kind);
  const deletes = photoPaths.filter((p) => !jobs.some((j) => j.kind && j.path === p));
  if (!owner || deletes.length === 0) return;
  for (const path of deletes) {
    jobs.push({
      kind: 'delete',
      uid: owner,
      receiptId,
      photoId: '',
      path,
      localUri: '',
      attempts: 0,
    });
  }
  await save();
  kickUploads();
}

/** The photo still waiting to upload for this Storage path, if any (shown from the device). */
export function queuedPhoto(path: string): UploadJob | undefined {
  return jobs.find((j) => j.path === path && !j.kind);
}

/** Test seam: swap the uploader (and remover) and start from an empty, unloaded queue. */
export function resetUploadsForTests(next?: Uploader, nextRemover?: Remover): void {
  uploader = next ?? firebaseUploader;
  remover = nextRemover ?? firebaseRemover;
  jobs = [];
  loaded = null;
  restored = false;
  toForget = [];
  running = false;
  uid = null;
  clearRetry();
}
