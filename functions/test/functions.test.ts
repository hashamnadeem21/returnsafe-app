import { describe, expect, it } from 'vitest';

import { adminAuth, bucket, call, db, signUp, tokenWithAuthTime } from './helpers';

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

describe('mergeGuestAccount (stub)', () => {
  it('accepts a guest token and rejects a non-guest token', async () => {
    const guest = await signUp();
    const me = await signUp(`merge-${Date.now()}@example.com`);
    const ok = await call<{ moved: number }>(
      'mergeGuestAccount',
      { guestIdToken: guest.idToken },
      me.idToken,
    );
    expect(ok.result).toEqual({ moved: 0 });
    const bad = await call('mergeGuestAccount', { guestIdToken: me.idToken }, me.idToken);
    expect(bad.error?.status).toBe('PERMISSION_DENIED');
  });
});
