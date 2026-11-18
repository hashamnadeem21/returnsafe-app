import { createHash, timingSafeEqual } from 'node:crypto';

import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

import { db } from './admin.js';
import { candidateUids, parseEvent, proChange, type RcEvent } from './billing/events.js';

/** The value set as the webhook's Authorization header in RevenueCat: "Bearer <secret>". */
const WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Compares in constant time, so the secret can't be guessed from response times. */
export function authorized(header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

/**
 * 'retry': a Pro grant for a user whose profile doesn't exist yet. Nothing is recorded and the
 * webhook answers 503, so RevenueCat delivers it again once initUser has created the profile.
 */
export type Outcome = 'applied' | 'duplicate' | 'ignored' | 'stale' | 'unknown-user' | 'retry';

/**
 * Applies one event in a transaction. billingEvents/{eventId} records every event handled, so a
 * retried or repeated delivery changes nothing. users/{uid}.proEventAt keeps the newest event's
 * time, so an older event that arrives late can't undo a newer one.
 */
export async function applyEvent(e: RcEvent, nowMs = Date.now()): Promise<Outcome> {
  const eventRef = db.doc(`billingEvents/${e.id}`);
  return db.runTransaction(async (tx) => {
    if ((await tx.get(eventRef)).exists) return 'duplicate';
    const record = (outcome: Outcome, uid: string | null = null) => {
      tx.create(eventRef, { type: e.type, uid, outcome, handledAt: FieldValue.serverTimestamp() });
      return outcome;
    };
    const at = e.event_timestamp_ms;

    // A transfer moves the purchase to another account (for example Restore on a new login). The
    // event carries no entitlement or expiry, so the accounts it leaves pass their Pro state and
    // expiry on to the accounts it moves to, and lose it themselves. Pro that has already ended
    // is not passed on. If none of the old accounts is known, the new ones are left as they are.
    if (e.type === 'TRANSFER') {
      const ids = (list: string[] | null | undefined) =>
        candidateUids({ id: e.id, type: e.type, aliases: list, event_timestamp_ms: at });
      const fromSnaps = await Promise.all(
        ids(e.transferred_from).map((u) => tx.get(db.doc(`users/${u}`))),
      );
      const toSnaps = await Promise.all(
        ids(e.transferred_to).map((u) => tx.get(db.doc(`users/${u}`))),
      );
      const known = fromSnaps.filter((snap) => snap.exists);
      const source = known.find((snap) => {
        const end = snap.get('proExpiresAt') as Timestamp | null | undefined;
        return snap.get('isPro') === true && (!end || end.toMillis() > nowMs);
      });
      const current = (snap: (typeof known)[number]) => (snap.get('proEventAt') ?? 0) <= at;
      let applied = false;
      const write = (snap: (typeof known)[number], isPro: boolean, expires: unknown) => {
        tx.update(snap.ref, {
          isPro,
          proExpiresAt: expires ?? null,
          proEventAt: at,
          updatedAt: FieldValue.serverTimestamp(),
        });
        applied = true;
      };
      if (known.length > 0) {
        for (const snap of toSnaps) {
          if (snap.exists && current(snap))
            write(snap, source !== undefined, source?.get('proExpiresAt'));
        }
      }
      for (const snap of known) if (current(snap)) write(snap, false, null);
      return record(applied ? 'applied' : 'ignored');
    }

    const change = proChange(e, nowMs);
    if (!change) return record('ignored');

    let user: { ref: DocumentReference; proEventAt: number } | null = null;
    for (const uid of candidateUids(e)) {
      const snap = await tx.get(db.doc(`users/${uid}`));
      if (snap.exists) {
        user = { ref: snap.ref, proEventAt: snap.get('proEventAt') ?? 0 };
        break;
      }
    }
    if (!user) return change.isPro ? 'retry' : record('unknown-user');
    if (user.proEventAt > at) return record('stale', user.ref.id);

    tx.update(user.ref, {
      isPro: change.isPro,
      ...(change.expiresAtMs === 'keep'
        ? {}
        : {
            proExpiresAt:
              change.expiresAtMs === null ? null : Timestamp.fromMillis(change.expiresAtMs),
          }),
      proEventAt: at,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return record('applied', user.ref.id);
  });
}

/**
 * RevenueCat webhook: keeps users/{uid}.isPro (what the rules and functions trust) in step with
 * the stores. Answers 401 to a wrong secret, 400 to a malformed event, 503 to a Pro grant for a
 * profile that doesn't exist yet, and 200 to everything it has handled, so RevenueCat retries
 * only what can still succeed.
 */
export const revenueCatWebhook = onRequest(
  { secrets: [WEBHOOK_SECRET], maxInstances: 5 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    if (!authorized(req.get('authorization'), WEBHOOK_SECRET.value())) {
      res.status(401).send('Unauthorized');
      return;
    }
    const event = parseEvent(req.body);
    if (!event) {
      res.status(400).send('Bad request');
      return;
    }
    try {
      const outcome = await applyEvent(event);
      logger.info('RevenueCat event', { id: event.id, type: event.type, outcome });
      res.status(outcome === 'retry' ? 503 : 200).json({ outcome });
    } catch (e) {
      logger.error('RevenueCat event failed', { id: event.id, type: event.type, error: String(e) });
      res.status(500).send('Error');
    }
  },
);
