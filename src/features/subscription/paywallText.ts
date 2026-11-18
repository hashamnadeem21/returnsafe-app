/** Paywall words built from the store's prices (never hard-coded), per platform. */
import type { Plan } from './purchases';

export type StorePlatform = 'ios' | 'android';

export const PRO_FEATURES = [
  'Unlimited receipts',
  'Reminders 7, 3 and 1 day before',
  'Warranty tracking',
  'Up to 5 photos per receipt',
  'Export to PDF and CSV',
] as const;

type PlanText = Pick<Plan, 'period' | 'price' | 'trialDays'>;

const per = (p: PlanText) => (p.period === 'year' ? 'year' : 'month');

/** Under the plan name: "7-day free trial, then $19.99/year" or "Billed monthly". */
export function planCaption(p: PlanText): string {
  if (p.period === 'month') return 'Billed monthly';
  return p.trialDays ? `${p.trialDays}-day free trial, then ${p.price}/year` : `${p.price}/year`;
}

/** The main button. */
export function ctaLabel(p: PlanText): string {
  return p.trialDays ? `Start ${p.trialDays}-day free trial` : `Subscribe for ${p.price}/${per(p)}`;
}

/** Store account and where to cancel, as each store asks. */
export function storeTerms(platform: StorePlatform): { account: string; manage: string } {
  return platform === 'ios'
    ? { account: 'Apple ID', manage: 'Settings › Apple ID › Subscriptions' }
    : { account: 'Google Play account', manage: 'Play Store › Payments & subscriptions' };
}

/** Price, period, trial, auto-renewal, who charges and how to cancel. */
export function legalText(p: PlanText, platform: StorePlatform): string {
  const { account, manage } = storeTerms(platform);
  const price = p.trialDays
    ? `Free for ${p.trialDays} days, then ${p.price} per ${per(p)}.`
    : `${p.price} per ${per(p)}.`;
  return (
    `${price} Renews automatically unless cancelled at least 24 hours before the end of the ` +
    `period. Charged to your ${account}. Manage or cancel in ${manage}.`
  );
}
