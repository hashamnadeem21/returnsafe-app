import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
    await assertFails(getDoc(doc(as('alice'), 'other/thing')));
    await assertFails(setDoc(doc(as('alice'), 'other/thing'), { a: 1 }));
  });
});

/** A receipt as the app writes it. */
function receipt(fields: Record<string, unknown> = {}) {
  return {
    storeId: 'target',
    storeName: 'Target',
    purchaseDate: '2026-11-12',
    amountCents: 4820,
    items: ['Kids sneakers'],
    returnDays: 90,
    returnDeadline: '2027-02-10',
    warrantyMonths: null,
    warrantyEnd: null,
    status: 'active',
    photoPaths: [],
    ocrText: null,
    statusChangedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...fields,
  };
}

async function seedReceipt(uid: string, id: string, fields: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), `users/${uid}/receipts/${id}`), {
      ...receipt(fields),
      createdAt: new Date('2026-11-12T12:00:00Z'),
      updatedAt: new Date('2026-11-12T12:00:00Z'),
    }),
  );
}

async function setUser(uid: string, fields: Record<string, unknown>) {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), `users/${uid}`), { ...USER, ...fields }),
  );
}

describe('users/{uid}/receipts rules', () => {
  const mine = (id = 'r1') => doc(as('alice'), `users/alice/receipts/${id}`);

  it('owner can create, read, update and delete a receipt', async () => {
    await assertSucceeds(setDoc(mine(), receipt()));
    await assertSucceeds(getDoc(mine()));
    await assertSucceeds(updateDoc(mine(), { amountCents: 5000, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(mine()));
  });

  it("TC-304: user A cannot read or change user B's receipt", async () => {
    await seedReceipt('bob', 'r1');
    const bobs = doc(as('alice'), 'users/bob/receipts/r1');
    await assertFails(getDoc(bobs));
    await assertFails(updateDoc(bobs, { status: 'returned' }));
    await assertFails(deleteDoc(bobs));
    await assertFails(setDoc(doc(as('alice'), 'users/bob/receipts/r2'), receipt()));
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), 'users/bob/receipts/r1')),
    );
  });

  it('TC-306: a Free user with 5 active receipts cannot add a 6th active one', async () => {
    await setUser('alice', { activeCount: 5 });
    await assertFails(setDoc(mine('r6'), receipt()));
    // Returned or kept receipts do not count, so they can still be added.
    await assertSucceeds(setDoc(mine('r7'), receipt({ status: 'kept' })));
  });

  it('allows the 5th active receipt (activeCount 4)', async () => {
    await setUser('alice', { activeCount: 4 });
    await assertSucceeds(setDoc(mine('r5'), receipt()));
  });

  it('Pro users have no limit', async () => {
    await setUser('alice', { activeCount: 40, isPro: true });
    await assertSucceeds(setDoc(mine('r41'), receipt()));
  });

  it('moving a receipt back to active is limited like a new one, other edits are not', async () => {
    await setUser('alice', { activeCount: 5 });
    await seedReceipt('alice', 'kept', { status: 'kept' });
    await seedReceipt('alice', 'act');
    await assertFails(updateDoc(mine('kept'), { status: 'active', updatedAt: serverTimestamp() }));
    await assertSucceeds(
      updateDoc(mine('act'), { amountCents: 100, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      updateDoc(mine('act'), { status: 'returned', updatedAt: serverTimestamp() }),
    );
    await setUser('alice', { activeCount: 4 });
    await assertSucceeds(
      updateDoc(mine('kept'), { status: 'active', updatedAt: serverTimestamp() }),
    );
  });

  it('amountCents must be a whole number from 1 to 9,999,999', async () => {
    await assertSucceeds(setDoc(mine('a1'), receipt({ amountCents: 1 })));
    await assertSucceeds(setDoc(mine('a2'), receipt({ amountCents: 9999999 })));
    await assertFails(setDoc(mine('a3'), receipt({ amountCents: 0 })));
    await assertFails(setDoc(mine('a4'), receipt({ amountCents: 10000000 })));
    await assertFails(setDoc(mine('a5'), receipt({ amountCents: 48.2 })));
    await assertFails(setDoc(mine('a6'), receipt({ amountCents: '4820' })));
  });

  it('storeName must be 1 to 80 characters', async () => {
    await assertSucceeds(setDoc(mine('s1'), receipt({ storeName: 'x'.repeat(80) })));
    await assertFails(setDoc(mine('s2'), receipt({ storeName: '' })));
    await assertFails(setDoc(mine('s3'), receipt({ storeName: 'x'.repeat(81) })));
    await assertFails(setDoc(mine('s4'), receipt({ storeName: 42 })));
  });

  it('at most 50 items and 5 photo paths', async () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => `Item ${i}`);
    const photos = (n: number) =>
      Array.from({ length: n }, (_, i) => `users/alice/receipts/p/${i}.jpg`);
    await assertSucceeds(setDoc(mine('i1'), receipt({ items: items(50), photoPaths: photos(5) })));
    await assertFails(setDoc(mine('i2'), receipt({ items: items(51) })));
    await assertFails(setDoc(mine('i3'), receipt({ photoPaths: photos(6) })));
    await assertFails(setDoc(mine('i4'), receipt({ items: 'Sneakers' })));
  });

  it('dates must be YYYY-MM-DD and returnDays 0 to 365', async () => {
    await assertFails(setDoc(mine('d1'), receipt({ purchaseDate: '11/12/2026' })));
    await assertFails(setDoc(mine('d2'), receipt({ returnDeadline: new Date() })));
    await assertFails(setDoc(mine('d3'), receipt({ returnDays: 366 })));
    await assertFails(setDoc(mine('d4'), receipt({ returnDays: -1 })));
    await assertSucceeds(setDoc(mine('d5'), receipt({ returnDays: 365 })));
  });

  it('status must be a known value, and only the server sets "expired"', async () => {
    await assertFails(setDoc(mine('x1'), receipt({ status: 'expired' })));
    await assertFails(setDoc(mine('x2'), receipt({ status: 'lost' })));
    await seedReceipt('alice', 'old', { status: 'expired' });
    // An expired receipt can still be edited, and can be marked kept.
    await assertSucceeds(
      updateDoc(mine('old'), { amountCents: 100, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(mine('old'), { status: 'kept', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(mine('old'), { status: 'expired', updatedAt: serverTimestamp() }));
  });

  it('rejects unknown fields, missing fields and a changed createdAt', async () => {
    await assertFails(setDoc(mine('f1'), receipt({ isPro: true })));
    const { storeName: _drop, ...noStore } = receipt();
    await assertFails(setDoc(mine('f2'), noStore));
    await seedReceipt('alice', 'f3');
    await assertFails(updateDoc(mine('f3'), { createdAt: serverTimestamp() }));
  });
});

describe('users/{uid}/customStores rules', () => {
  const store = (fields: Record<string, unknown> = {}) => ({
    name: "Joe's Bikes",
    returnDays: 30,
    updatedAt: serverTimestamp(),
    ...fields,
  });

  it('owner can save and read a custom store window', async () => {
    const ref = doc(as('alice'), 'users/alice/customStores/joes-bikes');
    await assertSucceeds(setDoc(ref, store()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(deleteDoc(ref));
  });

  it('rejects bad values and other users', async () => {
    const ref = doc(as('alice'), 'users/alice/customStores/joes-bikes');
    await assertFails(setDoc(ref, store({ returnDays: 0 })));
    await assertFails(setDoc(ref, store({ returnDays: 400 })));
    await assertFails(setDoc(ref, store({ name: '' })));
    await assertFails(setDoc(ref, store({ extra: 1 })));
    await assertFails(setDoc(doc(as('bob'), 'users/alice/customStores/joes-bikes'), store()));
  });
});

describe('stores rules', () => {
  it('signed-in users can read the store list; nobody can write it', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'stores/target'), { name: 'Target', returnDays: 90 }),
    );
    await assertSucceeds(getDoc(doc(as('alice'), 'stores/target')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'stores/target')));
    await assertFails(setDoc(doc(as('alice'), 'stores/target'), { name: 'Target', returnDays: 1 }));
  });
});
