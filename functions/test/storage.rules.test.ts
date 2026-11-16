import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const PHOTO = 'users/alice/receipts/r1/p1.jpg';
const MB = 1024 * 1024;
const bytes = (size: number) => new Uint8Array(size);

beforeAll(async () => {
  const [host, port] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-returnsafe-storage',
    storage: {
      rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8'),
      host,
      port: Number(port),
    },
  });
});

afterAll(() => env.cleanup());
beforeEach(() => env.clearStorage());

const storageAs = (uid: string | null) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage();

/** put() returns an UploadTask, which is thenable; wrap it so the assert helpers get a Promise. */
const upload = (uid: string | null, path: string, data: Uint8Array, contentType: string) =>
  Promise.resolve(storageAs(uid).ref(path).put(data, { contentType }));

describe('TC-406: receipt photo Storage rules', () => {
  it('owner can upload a JPEG under 10 MB, read it and delete it', async () => {
    await assertSucceeds(upload('alice', PHOTO, bytes(2 * MB), 'image/jpeg'));
    await assertSucceeds(storageAs('alice').ref(PHOTO).getMetadata());
    await assertSucceeds(storageAs('alice').ref(PHOTO).delete());
  });

  it('uploading the same photo again overwrites it (retries make no duplicates)', async () => {
    await assertSucceeds(upload('alice', PHOTO, bytes(1024), 'image/jpeg'));
    await assertSucceeds(upload('alice', PHOTO, bytes(1024), 'image/jpeg'));
  });

  it('denies a 12 MB image', async () => {
    await assertFails(upload('alice', PHOTO, bytes(12 * MB), 'image/jpeg'));
  });

  it('denies a PDF', async () => {
    await assertFails(
      upload('alice', 'users/alice/receipts/r1/p1.jpg', bytes(1024), 'application/pdf'),
    );
  });

  it('denies other users and signed-out users', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref(PHOTO).put(bytes(1024), { contentType: 'image/jpeg' });
    });
    await assertFails(storageAs('bob').ref(PHOTO).getMetadata());
    await assertFails(storageAs('bob').ref(PHOTO).delete());
    await assertFails(upload('bob', PHOTO, bytes(1024), 'image/jpeg'));
    await assertFails(storageAs(null).ref(PHOTO).getMetadata());
    await assertFails(upload(null, PHOTO, bytes(1024), 'image/jpeg'));
  });

  it('denies names outside the receipt photo layout', async () => {
    await assertFails(upload('alice', 'users/alice/avatar.jpg', bytes(1024), 'image/jpeg'));
    await assertFails(upload('alice', 'users/alice/receipts/r1/p1.png', bytes(1024), 'image/png'));
    await assertFails(
      upload('alice', 'users/alice/receipts/r1/a/b.jpg', bytes(1024), 'image/jpeg'),
    );
  });
});
