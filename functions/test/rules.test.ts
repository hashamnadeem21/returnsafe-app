import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const USER = {
  reminderHour: 9,
  reminderDays: [7, 3, 1],
  timezone: 'America/New_York',
  activeCount: 0,
  isPro: false,
  proExpiresAt: null,
  freeLimit: 5,
  email: 'alice@example.com',
  displayName: 'Alice',
};

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-returnsafe-rules',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host,
      port: Number(port),
    },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice'), USER));
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe('users/{uid} rules', () => {
  it('owner can read their doc', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice')));
  });

  it('owner can update their settings', async () => {
    await assertSucceeds(
      updateDoc(doc(as('alice'), 'users/alice'), {
        displayName: 'Al',
        reminderHour: 8,
        timezone: 'Europe/London',
      }),
    );
  });

  it('another user cannot read or write it', async () => {
    await assertFails(getDoc(doc(as('bob'), 'users/alice')));
    await assertFails(updateDoc(doc(as('bob'), 'users/alice'), { displayName: 'Bob' }));
  });

  it('signed-out users cannot read it', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice')));
  });

  it('TC-305: client cannot set isPro, proExpiresAt, activeCount or freeLimit', async () => {
    const ref = doc(as('alice'), 'users/alice');
    await assertFails(updateDoc(ref, { isPro: true }));
    await assertFails(updateDoc(ref, { proExpiresAt: new Date() }));
    await assertFails(updateDoc(ref, { activeCount: 99 }));
    await assertFails(updateDoc(ref, { freeLimit: 1000 }));
  });

  it('client cannot create or delete user docs', async () => {
    await assertFails(setDoc(doc(as('carol'), 'users/carol'), { ...USER, isPro: false }));
    await assertFails(deleteDoc(doc(as('alice'), 'users/alice')));
  });

  it('rejects out-of-range values', async () => {
    const ref = doc(as('alice'), 'users/alice');
    await assertFails(updateDoc(ref, { reminderHour: 24 }));
    await assertFails(updateDoc(ref, { reminderDays: [1, 2, 3, 4] }));
    await assertFails(updateDoc(ref, { displayName: 'x'.repeat(81) }));
  });

  it('everything else is still denied', async () => {
    await assertFails(getDoc(doc(as('alice'), 'users/alice/receipts/r1')));
    await assertFails(setDoc(doc(as('alice'), 'other/thing'), { a: 1 }));
  });
});
