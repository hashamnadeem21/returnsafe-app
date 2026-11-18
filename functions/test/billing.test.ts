import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import { proChange, type RcEvent } from '../src/billing/events';
import { db, PROJECT_ID, receipt, signUp, waitForActiveCount } from './helpers';

/** The secret the emulator loaded from functions/.secret.local. */
const SECRET = readFileSync(resolve(__dirname, '../.secret.local'), 'utf8')
  .split('\n')
  .find((l) => l.startsWith('REVENUECAT_WEBHOOK_SECRET='))!
  .split('=')[1]
  .trim();
const WEBHOOK = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/revenueCatWebhook`;

const DAY = 86_400_000;
let seq = 0;

/** A RevenueCat event for the "pro" entitlement with a fresh id. */
function rcEvent(type: string, uid: string, fields: Partial<RcEvent> = {}): RcEvent {
  seq += 1;
  return {
    id: `evt-${Date.now()}-${seq}`,
    type,
    app_user_id: uid,
    original_app_user_id: uid,
    aliases: [uid],
    entitlement_ids: ['pro'],
    expiration_at_ms: Date.now() + 365 * DAY,
    event_timestamp_ms: Date.now() + seq,
    ...fields,
  };
}

async function deliver(event: unknown, auth: string | null = `Bearer ${SECRET}`) {
  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify({ api_version: '1.0', event }),
  });
  const text = await res.text();
  let outcome: string | undefined;
  try {
    outcome = (JSON.parse(text) as { outcome?: string }).outcome;
  } catch {
    outcome = undefined;
  }
  return { status: res.status, outcome };
}

let users = 0;
/** A users/{uid} document as initUser creates it. */
async function newUser(fields: Record<string, unknown> = {}): Promise<string> {
  users += 1;
  const uid = `billing-${Date.now()}-${users}`;
  await db.doc(`users/${uid}`).set({
    reminderHour: 9,
    reminderDays: [7, 3, 1],
    timezone: 'America/New_York',
    remindersEnabled: true,
    fcmTokens: [],
    activeCount: 0,
    isPro: false,
    proExpiresAt: null,
    freeLimit: 5,
    ...fields,
  });
  return uid;
}

async function pro(uid: string) {
  const d = (await db.doc(`users/${uid}`).get()).data()!;
  return {
    isPro: d.isPro as boolean,
    expiresAt: d.proExpiresAt ? (d.proExpiresAt as Timestamp).toMillis() : null,
  };
}

describe('revenueCatWebhook: authorisation (TC-605)', () => {
  it('answers 401 to a wrong or missing secret and changes nothing', async () => {
    const uid = await newUser();
    const e = rcEvent('INITIAL_PURCHASE', uid);
    expect((await deliver(e, 'Bearer wrong-secret')).status).toBe(401);
    expect((await deliver(e, SECRET)).status).toBe(401); // without "Bearer "
    expect((await deliver(e, null)).status).toBe(401);
    expect(await pro(uid)).toEqual({ isPro: false, expiresAt: null });
    expect((await db.doc(`billingEvents/${e.id}`).get()).exists).toBe(false);
    // The same event with the right secret still works afterwards (nothing was recorded).
    expect((await deliver(e)).outcome).toBe('applied');
  });

  it('answers 400 to a body without an event and 405 to other methods', async () => {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ nothing: true }),
    });
    expect(res.status).toBe(400);
    expect((await fetch(WEBHOOK)).status).toBe(405);
  });
});

describe('revenueCatWebhook: one test per event type, each delivered twice', () => {
  it('INITIAL_PURCHASE: Pro until the expiry; the repeat is a duplicate', async () => {
    const uid = await newUser();
    const e = rcEvent('INITIAL_PURCHASE', uid);
    expect(await deliver(e)).toEqual({ status: 200, outcome: 'applied' });
    expect(await pro(uid)).toEqual({ isPro: true, expiresAt: e.expiration_at_ms });
    expect(await deliver(e)).toEqual({ status: 200, outcome: 'duplicate' });
    expect(await pro(uid)).toEqual({ isPro: true, expiresAt: e.expiration_at_ms });
  });

  it('RENEWAL: moves the expiry on; the repeat is a duplicate', async () => {
    const uid = await newUser({ isPro: true, proExpiresAt: Timestamp.fromMillis(Date.now()) });
    const e = rcEvent('RENEWAL', uid, { expiration_at_ms: Date.now() + 30 * DAY });
    expect((await deliver(e)).outcome).toBe('applied');
    expect(await pro(uid)).toEqual({ isPro: true, expiresAt: e.expiration_at_ms });
    expect((await deliver(e)).outcome).toBe('duplicate');
    expect(await pro(uid)).toEqual({ isPro: true, expiresAt: e.expiration_at_ms });
  });

  it('UNCANCELLATION: Pro again; the repeat is a duplicate', async () => {
    const uid = await newUser();
    const e = rcEvent('UNCANCELLATION', uid);
    expect((await deliver(e)).outcome).toBe('applied');
    expect((await pro(uid)).isPro).toBe(true);
    expect((await deliver(e)).outcome).toBe('duplicate');
    expect((await pro(uid)).isPro).toBe(true);
  });

  it('PRODUCT_CHANGE: stays Pro with the new expiry; the repeat is a duplicate', async () => {
    const uid = await newUser({ isPro: true });
    const e = rcEvent('PRODUCT_CHANGE', uid, { expiration_at_ms: Date.now() + 20 * DAY });
    expect((await deliver(e)).outcome).toBe('applied');
    expect(await pro(uid)).toEqual({ isPro: true, expiresAt: e.expiration_at_ms });
    expect((await deliver(e)).outcome).toBe('duplicate');
  });

  it('CANCELLATION: Pro stays until the paid period ends; the repeat is a duplicate', async () => {
    const uid = await newUser({ isPro: true });
    const end = Date.now() + 10 * DAY;
    const e = rcEvent('CANCELLATION', uid, { expiration_at_ms: end });
    expect((await deliver(e)).outcome).toBe('applied');
    expect(await pro(uid)).toEqual({ isPro: true, expiresAt: end });
    expect((await deliver(e)).outcome).toBe('duplicate');
    expect(await pro(uid)).toEqual({ isPro: true, expiresAt: end });
    // A refund cancels with an expiry that has already passed: Pro ends now.
    const refund = rcEvent('CANCELLATION', uid, { expiration_at_ms: Date.now() - 1000 });
    expect((await deliver(refund)).outcome).toBe('applied');
    expect((await pro(uid)).isPro).toBe(false);
  });

  it('TC-604 EXPIRATION: isPro false, receipts still readable, 6th active blocked', async () => {
    const me = await signUp(`expire-${Date.now()}@example.com`);
    await db.doc(`users/${me.uid}`).set({
      reminderHour: 9,
      reminderDays: [7, 3, 1],
      timezone: 'America/New_York',
      activeCount: 0,
      isPro: true,
      proExpiresAt: Timestamp.fromMillis(Date.now() + DAY),
      freeLimit: 5,
    });
    for (let i = 0; i < 6; i += 1) {
      await db.doc(`users/${me.uid}/receipts/r${i}`).set(receipt());
    }
    await waitForActiveCount(me.uid, 6);

    const e = rcEvent('EXPIRATION', me.uid, { expiration_at_ms: Date.now() - 1000 });
    expect((await deliver(e)).outcome).toBe('applied');
    expect(await pro(me.uid)).toEqual({ isPro: false, expiresAt: e.expiration_at_ms });
    expect((await deliver(e)).outcome).toBe('duplicate');
    expect((await pro(me.uid)).isPro).toBe(false);

    // Through the rules, as the app: existing receipts read fine, a new active one is refused.
    const docs = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${me.uid}/receipts`;
    const headers = { Authorization: `Bearer ${me.idToken}`, 'Content-Type': 'application/json' };
    const read = await fetch(`${docs}/r0`, { headers });
    expect(read.status).toBe(200);
    const now = new Date().toISOString();
    const create = await fetch(`${docs}?documentId=r6`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          storeId: { stringValue: 'target' },
          storeName: { stringValue: 'Target' },
          purchaseDate: { stringValue: '2026-11-01' },
          amountCents: { integerValue: '4820' },
          items: { arrayValue: { values: [{ stringValue: 'Lamp' }] } },
          returnDays: { integerValue: '90' },
          returnDeadline: { stringValue: '2027-01-30' },
          warrantyMonths: { nullValue: null },
          warrantyEnd: { nullValue: null },
          status: { stringValue: 'active' },
          photoPaths: { arrayValue: {} },
          ocrText: { nullValue: null },
          statusChangedAt: { nullValue: null },
          createdAt: { timestampValue: now },
          updatedAt: { timestampValue: now },
        },
      }),
    });
    expect(create.status).toBe(403);
  });

  it('TC-609 BILLING_ISSUE: Pro stays until the grace period ends; repeat is a duplicate', async () => {
    const uid = await newUser({ isPro: true });
    const grace = Date.now() + 16 * DAY;
    const e = rcEvent('BILLING_ISSUE', uid, {
      expiration_at_ms: Date.now() - DAY,
      grace_period_expiration_at_ms: grace,
    });
    expect((await deliver(e)).outcome).toBe('applied');
    expect(await pro(uid)).toEqual({ isPro: true, expiresAt: grace });
    expect((await deliver(e)).outcome).toBe('duplicate');
    expect(await pro(uid)).toEqual({ isPro: true, expiresAt: grace });
    // When the grace period is over, the store sends EXPIRATION.
    const expired = rcEvent('EXPIRATION', uid, { expiration_at_ms: grace });
    expect((await deliver(expired)).outcome).toBe('applied');
    expect((await pro(uid)).isPro).toBe(false);
  });

  it('TRANSFER: the purchase moves to the account that restored it; repeat is a duplicate', async () => {
    const from = await newUser({ isPro: true });
    const to = await newUser();
    const e = rcEvent('TRANSFER', to, {
      app_user_id: null,
      original_app_user_id: null,
      aliases: null,
      transferred_from: [from],
      transferred_to: [to],
    });
    expect((await deliver(e)).outcome).toBe('applied');
    expect((await pro(from)).isPro).toBe(false);
    expect((await pro(to)).isPro).toBe(true);
    expect((await deliver(e)).outcome).toBe('duplicate');
  });
});

describe('revenueCatWebhook: order, users and entitlements', () => {
  it('an older event that arrives late does not undo a newer one', async () => {
    const uid = await newUser();
    const t = Date.now();
    const expired = rcEvent('EXPIRATION', uid, { event_timestamp_ms: t + 2000 });
    const renewal = rcEvent('RENEWAL', uid, { event_timestamp_ms: t + 1000 });
    expect((await deliver(expired)).outcome).toBe('applied');
    expect((await deliver(renewal)).outcome).toBe('stale');
    expect((await pro(uid)).isPro).toBe(false);
  });

  it('finds the user by alias when the app user id is anonymous', async () => {
    const uid = await newUser();
    const e = rcEvent('INITIAL_PURCHASE', uid, {
      app_user_id: '$RCAnonymousID:abc123',
      original_app_user_id: '$RCAnonymousID:abc123',
      aliases: ['$RCAnonymousID:abc123', uid],
    });
    expect((await deliver(e)).outcome).toBe('applied');
    expect((await pro(uid)).isPro).toBe(true);
  });

  it('ignores other entitlements, unknown users and other event types', async () => {
    const uid = await newUser();
    expect(
      (await deliver(rcEvent('INITIAL_PURCHASE', uid, { entitlement_ids: ['other'] }))).outcome,
    ).toBe('ignored');
    expect((await deliver(rcEvent('INITIAL_PURCHASE', 'no-such-user'))).outcome).toBe(
      'unknown-user',
    );
    expect((await deliver(rcEvent('TEST', uid))).outcome).toBe('ignored');
    expect((await pro(uid)).isPro).toBe(false);
  });
});

describe('proChange', () => {
  const now = Date.UTC(2026, 10, 18);
  const e = (type: string, f: Partial<RcEvent> = {}): RcEvent => ({
    id: 'x',
    type,
    entitlement_ids: ['pro'],
    ...f,
  });

  it('maps each event type', () => {
    for (const t of ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']) {
      expect(proChange(e(t, { expiration_at_ms: now + 1 }), now)).toEqual({
        isPro: true,
        expiresAtMs: now + 1,
      });
    }
    expect(proChange(e('EXPIRATION'), now)).toEqual({ isPro: false, expiresAtMs: 'keep' });
    expect(proChange(e('CANCELLATION', { expiration_at_ms: now + 1 }), now)?.isPro).toBe(true);
    expect(proChange(e('CANCELLATION'), now)).toBeNull();
    expect(proChange(e('BILLING_ISSUE', { expiration_at_ms: now - 1 }), now)?.isPro).toBe(false);
    expect(proChange(e('SUBSCRIPTION_PAUSED'), now)).toBeNull();
    expect(proChange(e('RENEWAL', { entitlement_ids: [] }), now)).toBeNull();
    // No entitlement list at all (older payloads) still counts.
    expect(proChange(e('RENEWAL', { entitlement_ids: null }), now)?.isPro).toBe(true);
  });
});
