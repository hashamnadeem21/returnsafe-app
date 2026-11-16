/**
 * Uploads receipt photos in the background, and deletes the photos of deleted receipts. Jobs are
 * saved on the device, so a photo taken offline uploads once the app is back online, even after a
 * restart. Each photo has a fixed Storage path (its photoId never changes), so a retry overwrites
 * the same file instead of adding a copy, and a path that is already queued is never queued twice.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteObject, putFile, ref } from '@react-native-firebase/storage';
import { File } from 'expo-file-system';

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
const SAVE_RETRY_MS = 5_000;
const SAVE_TRIES = 3;
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
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Device photos to delete once the queue without their jobs is saved. */
let toForget: string[] = [];
/** Saves run one after another, so an older snapshot can never land after a newer one. */
let saving: Promise<boolean> = Promise.resolve(true);
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Called whenever the queue changes (restored, job added, uploaded or dropped). */
export function subscribeUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const isJob = (j: unknown): j is UploadJob =>
  typeof j === 'object' &&
  j !== null &&
  typeof (j as UploadJob).uid === 'string' &&
  typeof (j as UploadJob).path === 'string' &&
  typeof (j as UploadJob).receiptId === 'string';

/** The saved jobs; an unreadable or damaged value counts as an empty queue. */
function parseSaved(raw: string | null): UploadJob[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter(isJob) : [];
  } catch {
    return [];
  }
}

function load(): Promise<void> {
  loaded ??= AsyncStorage.getItem(QUEUE_KEY).then(
    async (raw) => {
      const saved = parseSaved(raw);
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

function retrySaveLater() {
  saveTimer ??= setTimeout(() => {
    saveTimer = null;
    void save();
  }, SAVE_RETRY_MS);
}

/**
 * Saves the queue. False when it could not be saved (or the saved queue is not read yet); a failed
 * save is tried again a little later. Device photos are deleted only by the save whose snapshot
 * no longer lists their jobs.
 */
function save(): Promise<boolean> {
  if (!restored) return Promise.resolve(false);
  saving = saving.then(async () => {
    // Taken together: the snapshot and the photos whose jobs it no longer lists.
    const snapshot = JSON.stringify(jobs);
    const freed = toForget;
    toForget = [];
    try {
      await AsyncStorage.setItem(QUEUE_KEY, snapshot);
    } catch {
      toForget = [...freed, ...toForget];
      retrySaveLater();
      return false;
    }
    for (const id of freed) forgetLocalPhoto(id);
    return true;
  });
  return saving;
}

/** Saves now, trying a few times, for changes that must be on disk before going on. */
async function saveNow(): Promise<boolean> {
  for (let i = 0; i < SAVE_TRIES; i++) if (await save()) return true;
  return false;
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
      if (!job.kind && !new File(job.localUri).exists) {
        // The device copy is gone (for example the app's files were cleared): it can never
        // upload, so drop it instead of blocking the jobs behind it.
        await drop((j) => j === job);
        continue;
      }
      try {
        if (job.kind === 'delete') await remover(job.path);
        else await uploader(job);
        await drop((j) => j === job);
      } catch {
        // Cancelled while it was running (the receipt was deleted): never bring it back.
        if (!jobs.includes(job)) continue;
        // Offline or a passing error: try again later. The job moves to the back, so one that
        // keeps failing never holds up the others.
        job.attempts += 1;
        jobs = [...jobs.filter((j) => j !== job), job];
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
 * offline is tried again later instead of leaving the photo behind. Resolves once the delete jobs
 * are saved on the device (or could not be after a few tries).
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
  await saveNow();
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
  saving = Promise.resolve(true);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  running = false;
  uid = null;
  clearRetry();
}
