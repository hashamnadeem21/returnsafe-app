/**
 * Crash reports and usage events. Events carry no personal data: no names, emails, stores,
 * amounts, items, uids or free text, only the fixed values typed below. Collection is off in
 * development and E2E (emulator) builds; firebase.json keeps it off until `startTelemetry` runs,
 * and advertising and device identifiers are never collected.
 */
import {
  getAnalytics,
  logEvent,
  setAnalyticsCollectionEnabled,
} from '@react-native-firebase/analytics';
import { getApp } from '@react-native-firebase/app';
import {
  getCrashlytics,
  recordError,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';

/** Every event the app sends, with its only allowed parameters. */
export type TelemetryEvent =
  | { name: 'onboarding_complete' }
  | { name: 'sign_up'; method: 'email' | 'apple' | 'google' | 'guest' }
  | { name: 'receipt_added'; source: 'scan' | 'manual' }
  | { name: 'receipt_returned' }
  | { name: 'paywall_view'; source: PaywallSource }
  | { name: 'purchase_start'; plan: 'year' | 'month' }
  | { name: 'purchase_success'; plan: 'year' | 'month' };

/** Where the paywall was opened from. */
export const PAYWALL_SOURCES = [
  'settings',
  'limit',
  'warranties',
  'warranty',
  'photos',
  'reminders',
  'export',
  'other',
] as const;
export type PaywallSource = (typeof PAYWALL_SOURCES)[number];

/** A route param to a known paywall source ("other" for anything else). */
export function paywallSource(value: unknown): PaywallSource {
  return (PAYWALL_SOURCES as readonly unknown[]).includes(value)
    ? (value as PaywallSource)
    : 'other';
}

let enabled = false;

/** Turns collection on for real builds. Off (and nothing is ever sent) when `on` is false. */
export async function startTelemetry(on: boolean): Promise<void> {
  enabled = on;
  try {
    const app = getApp();
    await Promise.all([
      setAnalyticsCollectionEnabled(getAnalytics(app), on),
      setCrashlyticsCollectionEnabled(getCrashlytics(), on),
    ]);
  } catch {
    // Telemetry must never break the app.
  }
}

/** Sends one event. Does nothing while collection is off; never throws. */
export function track(event: TelemetryEvent): void {
  if (!enabled) return;
  const { name, ...params } = event;
  // One signature for every event; the typed overloads differ per event name.
  const send = logEvent as unknown as (
    analytics: ReturnType<typeof getAnalytics>,
    name: string,
    params: Record<string, string>,
  ) => Promise<void> | void;
  try {
    void Promise.resolve(send(getAnalytics(getApp()), name, params)).catch(() => undefined);
  } catch {
    // ignore
  }
}

/** Reports a handled error to Crashlytics (its message only, never user data). */
export function reportError(error: unknown, context: string): void {
  if (!enabled) return;
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    recordError(getCrashlytics(), e, context);
  } catch {
    // ignore
  }
}

/** Test seam. */
export function telemetryEnabled(): boolean {
  return enabled;
}
