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

export type Outcome = 'applied' | 'duplicate' | 'ignored' | 'stale' | 'unknown-user';

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
    const at = typeof e.event_timestamp_ms === 'number' ? e.event_timestamp_ms : nowMs;

    // A transfer moves the purchase to another account (for example Restore on a new login).
    if (e.type === 'TRANSFER') {
      const ids = (list: string[] | null | undefined) =>
        candidateUids({ id: e.id, type: e.type, aliases: list });
      const moves: [string, boolean][] = [
        ...ids(e.transferred_from).map((u): [string, boolean] => [u, false]),
        ...ids(e.transferred_to).map((u): [string, boolean] => [u, true]),
      ];
      const snaps = await Promise.all(moves.map(([u]) => tx.get(db.doc(`users/${u}`))));
      let applied = false;
      snaps.forEach((snap, i) => {
        if (!snap.exists || (snap.get('proEventAt') ?? 0) > at) return;
        tx.update(snap.ref, {
          isPro: moves[i][1],
          proEventAt: at,
          updatedAt: FieldValue.serverTimestamp(),
        });
        applied = true;
      });
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
    if (!user) return record('unknown-user');
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
 * the stores. Answers 401 to a wrong secret and 200 to everything it has handled, so RevenueCat
 * only retries real failures.
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
      res.status(200).json({ outcome });
    } catch (e) {
      logger.error('RevenueCat event failed', { id: event.id, type: event.type, error: String(e) });
      res.status(500).send('Error');
    }
  },
);
