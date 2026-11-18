/**
 * What a RevenueCat webhook event means for users/{uid}.isPro and proExpiresAt.
 * https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */

export const PRO_ENTITLEMENT = 'pro';

/** The fields of a RevenueCat event that the webhook uses. */
export type RcEvent = {
  id: string;
  type: string;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  event_timestamp_ms?: number | null;
};

/** The change to write: isPro, and proExpiresAt in ms ('keep' leaves the stored value). */
export type ProChange = { isPro: boolean; expiresAtMs: number | null | 'keep' };

const GRANTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);

/** True for ids RevenueCat makes up before logIn; they never match a Firebase uid. */
export function isAnonymousId(id: string): boolean {
  return id.startsWith('$RCAnonymousID:');
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Checks the shape of a webhook body and returns its event, or null. */
export function parseEvent(body: unknown): RcEvent | null {
  if (!body || typeof body !== 'object') return null;
  const event = (body as { event?: unknown }).event;
  if (!event || typeof event !== 'object') return null;
  const e = event as Record<string, unknown>;
  if (typeof e.id !== 'string' || e.id.length === 0 || e.id.length > 200) return null;
  if (typeof e.type !== 'string') return null;
  return e as unknown as RcEvent;
}

/** False when the event names entitlements and "pro" is not one of them. */
export function touchesPro(e: RcEvent): boolean {
  return !Array.isArray(e.entitlement_ids) || e.entitlement_ids.includes(PRO_ENTITLEMENT);
}

/** The Firebase uids an event may belong to, most likely first (the app logs in with the uid). */
export function candidateUids(e: RcEvent): string[] {
  const ids = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])].filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && !isAnonymousId(id),
  );
  return [...new Set(ids)].filter((id) => !id.includes('/') && id.length <= 128);
}

/**
 * The change an event makes, or null when it changes nothing:
 * - INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE: Pro until the new expiry.
 * - CANCELLATION: auto-renew is off, but Pro stays until the paid period ends.
 * - BILLING_ISSUE: Pro stays through the store's grace period (or until expiry without one).
 * - EXPIRATION: Pro ends.
 */
export function proChange(e: RcEvent, nowMs: number): ProChange | null {
  if (!touchesPro(e)) return null;
  const expiry = isNum(e.expiration_at_ms) ? e.expiration_at_ms : null;
  if (GRANTS.has(e.type)) return { isPro: true, expiresAtMs: expiry };
  if (e.type === 'EXPIRATION') return { isPro: false, expiresAtMs: expiry ?? 'keep' };
  if (e.type === 'CANCELLATION') {
    if (expiry === null) return null;
    return { isPro: expiry > nowMs, expiresAtMs: expiry };
  }
  if (e.type === 'BILLING_ISSUE') {
    const end = isNum(e.grace_period_expiration_at_ms) ? e.grace_period_expiration_at_ms : expiry;
    if (end === null) return null;
    return { isPro: end > nowMs, expiresAtMs: end };
  }
  return null;
}
