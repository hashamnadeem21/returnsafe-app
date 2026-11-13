import { describe, expect, it } from 'vitest';

import {
  adminAuth,
  bucket,
  call,
  db,
  receipt,
  signUp,
  tokenWithAuthTime,
  waitForActiveCount,
} from './helpers';

describe('initUser', () => {
  it('creates users/{uid} with server defaults on first sign-in (TC-201 backend)', async () => {
    const me = await signUp(`init-${Date.now()}@example.com`);
    const r = await call<{ created: boolean }>(
      'initUser',
      { timezone: 'America/Chicago', displayName: 'Sam' },
      me.idToken,
    );
    expect(r.result).toEqual({ created: true });
    const doc = (await db.doc(`users/${me.uid}`).get()).data();
    expect(doc).toMatchObject({
      reminderHour: 9,
      reminderDays: [7, 3, 1],
      timezone: 'America/Chicago',
      activeCount: 0,
      isPro: false,
      freeLimit: 5,
      displayName: 'Sam',
    });
    expect(doc?.createdAt).toBeDefined();
  });

  it('is idempotent, never resets isPro, and falls back on a bad timezone', async () => {
    const me = await signUp(`idem-${Date.now()}@example.com`);
    await call('initUser', { timezone: 'Not/AZone' }, me.idToken);
    expect((await db.doc(`users/${me.uid}`).get()).get('timezone')).toBe('America/New_York');
    await db.doc(`users/${me.uid}`).update({ isPro: true });
    const again = await call<{ created: boolean }>(
      'initUser',
      { timezone: 'Europe/Paris' },
      me.idToken,
    );
    expect(again.result).toEqual({ created: false });
    const doc = (await db.doc(`users/${me.uid}`).get()).data();
    expect(doc?.isPro).toBe(true);
    expect(doc?.timezone).toBe('America/New_York');
  });

  it('trims an over-long name from the auth profile', async () => {
    const me = await signUp(`longname-${Date.now()}@example.com`);
    await adminAuth.updateUser(me.uid, { displayName: 'N'.repeat(200) });
    await call('initUser', {}, me.idToken);
    expect((await db.doc(`users/${me.uid}`).get()).get('displayName')).toBe('N'.repeat(80));
  });

  it('rejects unauthenticated calls', async () => {
    const r = await call('initUser', {});
    expect(r.error?.status).toBe('UNAUTHENTICATED');
  });
});

describe('deleteAccount', () => {
  it('TC-211: removes the user doc, 3 receipts, 2 photos and the auth user', async () => {
    const me = await signUp(`del-${Date.now()}@example.com`);
    const other = await signUp(`keep-${Date.now()}@example.com`);
    await call('initUser', {}, me.idToken);
    await call('initUser', {}, other.idToken);
    for (const id of ['r1', 'r2', 'r3']) {
      await db.doc(`users/${me.uid}/receipts/${id}`).set({ store: `Store ${id}` });
    }
    await bucket.file(`users/${me.uid}/receipts/r1/photo-1.jpg`).save(Buffer.from('jpg1'));
    await bucket.file(`users/${me.uid}/receipts/r2/photo-1.jpg`).save(Buffer.from('jpg2'));
    await bucket.file(`users/${other.uid}/receipts/x/photo-1.jpg`).save(Buffer.from('keep'));

    const r = await call<{ deleted: boolean }>('deleteAccount', {}, me.idToken);
    expect(r.result).toEqual({ deleted: true });

    expect((await db.doc(`users/${me.uid}`).get()).exists).toBe(false);
    expect((await db.collection(`users/${me.uid}/receipts`).get()).size).toBe(0);
    const [files] = await bucket.getFiles({ prefix: `users/${me.uid}/` });
    expect(files).toHaveLength(0);
    await expect(adminAuth.getUser(me.uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });

    // Someone else's data is untouched.
    expect((await db.doc(`users/${other.uid}`).get()).exists).toBe(true);
    const [otherFiles] = await bucket.getFiles({ prefix: `users/${other.uid}/` });
    expect(otherFiles).toHaveLength(1);
  });

  it('asks for a recent login when the sign-in is older than 5 minutes', async () => {
    const me = await signUp(`stale-${Date.now()}@example.com`);
    const stale = tokenWithAuthTime(me.uid, Math.floor(Date.now() / 1000) - 3600);
    const r = await call('deleteAccount', {}, stale);
    expect(r.error?.status).toBe('FAILED_PRECONDITION');
    expect(r.error?.details).toEqual({ reason: 'requires-recent-login' });
    expect((await adminAuth.getUser(me.uid)).uid).toBe(me.uid);
  });

  it('ignores a stale guest token after the guest saved their account', async () => {
    const guest = await signUp();
    const old = tokenWithAuthTime(guest.uid, Math.floor(Date.now() / 1000) - 3600, 'anonymous');
    await adminAuth.updateUser(guest.uid, {
      email: `linked-${Date.now()}@example.com`,
      password: 'Test1234',
    });
    const r = await call('deleteAccount', {}, old);
    expect(r.error?.details).toEqual({ reason: 'requires-recent-login' });
    expect((await adminAuth.getUser(guest.uid)).uid).toBe(guest.uid);
  });

  it('lets a guest delete without re-authenticating', async () => {
    const guest = await signUp();
    await call('initUser', {}, guest.idToken);
    const old = tokenWithAuthTime(guest.uid, Math.floor(Date.now() / 1000) - 3600, 'anonymous');
    const r = await call<{ deleted: boolean }>('deleteAccount', {}, old);
    expect(r.result).toEqual({ deleted: true });
    await expect(adminAuth.getUser(guest.uid)).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });
  });
});

describe('onReceiptWrite', () => {
  it('keeps activeCount right through create, status change, update and delete', async () => {
    const me = await signUp(`count-${Date.now()}@example.com`);
    await call('initUser', {}, me.idToken);
    const col = db.collection(`users/${me.uid}/receipts`);

    const a = await col.add(receipt());
    const b = await col.add(receipt());
    await col.add(receipt({ status: 'kept' }));
    await waitForActiveCount(me.uid, 2);

    await b.update({ status: 'returned' });
    await waitForActiveCount(me.uid, 1);

    await a.update({ amountCents: 999 }); // not a status change
    await b.update({ status: 'active' });
    await waitForActiveCount(me.uid, 2);

    await a.delete();
    await waitForActiveCount(me.uid, 1);
  });
});

describe('mergeGuestAccount', () => {
  it("moves the guest's receipts, photos and custom stores, then deletes the guest", async () => {
    const guest = await signUp();
    await call('initUser', {}, guest.idToken);
    const me = await signUp(`merge-${Date.now()}@example.com`);
    await call('initUser', {}, me.idToken);
    const photo = `users/${guest.uid}/receipts/r1/receipt.jpg`;
    await bucket.file(photo).save(Buffer.from('jpg'), { contentType: 'image/jpeg' });
    await db.doc(`users/${guest.uid}/receipts/r1`).set(receipt({ photoPaths: [photo] }));
    await db.doc(`users/${guest.uid}/receipts/r2`).set(receipt({ status: 'returned' }));
    await db
      .doc(`users/${guest.uid}/customStores/joes-bikes`)
      .set({ name: "Joe's Bikes", returnDays: 30 });
    await db
      .doc(`users/${me.uid}/customStores/corner-shop`)
      .set({ name: 'Corner Shop', returnDays: 14 });
    await db
      .doc(`users/${guest.uid}/customStores/corner-shop`)
      .set({ name: 'Corner Shop', returnDays: 60 });

    const r = await call<{ moved: number }>(
      'mergeGuestAccount',
      { guestIdToken: guest.idToken },
      me.idToken,
    );
    expect(r.result).toEqual({ moved: 2 });

    const moved = await db.doc(`users/${me.uid}/receipts/r1`).get();
    const newPhoto = `users/${me.uid}/receipts/r1/receipt.jpg`;
    expect(moved.get('photoPaths')).toEqual([newPhoto]);
    expect((await bucket.file(newPhoto).exists())[0]).toBe(true);
    expect((await db.doc(`users/${me.uid}/receipts/r2`).get()).get('status')).toBe('returned');
    expect((await db.doc(`users/${me.uid}/customStores/joes-bikes`).get()).get('returnDays')).toBe(
      30,
    );
    // The account's own window for a store wins.
    expect((await db.doc(`users/${me.uid}/customStores/corner-shop`).get()).get('returnDays')).toBe(
      14,
    );
    await waitForActiveCount(me.uid, 1);

    expect((await db.doc(`users/${guest.uid}`).get()).exists).toBe(false);
    expect((await db.collection(`users/${guest.uid}/receipts`).get()).size).toBe(0);
    await expect(adminAuth.getUser(guest.uid)).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });

    // A retry after success is harmless.
    const again = await call<{ moved: number }>(
      'mergeGuestAccount',
      { guestIdToken: guest.idToken },
      me.idToken,
    );
    // The emulator refuses tokens of deleted users; production returns moved: 0. Either way the app
    // drops its pending merge and nothing moves twice.
    if (again.error) expect(again.error.status).toBe('PERMISSION_DENIED');
    else expect(again.result).toEqual({ moved: 0 });
    expect((await db.collection(`users/${me.uid}/receipts`).get()).size).toBe(2);
  });

  it('rejects a non-guest token and a guest that has since saved its account', async () => {
    const me = await signUp(`merge-bad-${Date.now()}@example.com`);
    const bad = await call('mergeGuestAccount', { guestIdToken: me.idToken }, me.idToken);
    expect(bad.error?.status).toBe('PERMISSION_DENIED');

    const guest = await signUp();
    await db.doc(`users/${guest.uid}/receipts/keep`).set(receipt());
    await adminAuth.updateUser(guest.uid, {
      email: `saved-${Date.now()}@example.com`,
      password: 'Test1234',
    });
    const linked = await call('mergeGuestAccount', { guestIdToken: guest.idToken }, me.idToken);
    expect(linked.error?.status).toBe('PERMISSION_DENIED');
    expect((await db.doc(`users/${guest.uid}/receipts/keep`).get()).exists).toBe(true);
  });

  it('rejects unauthenticated calls and a missing token', async () => {
    expect((await call('mergeGuestAccount', { guestIdToken: 'x' })).error?.status).toBe(
      'UNAUTHENTICATED',
    );
    const me = await signUp(`merge-none-${Date.now()}@example.com`);
    expect((await call('mergeGuestAccount', {}, me.idToken)).error?.status).toBe(
      'INVALID_ARGUMENT',
    );
  });
});
