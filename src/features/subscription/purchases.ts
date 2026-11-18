/**
 * RevenueCat: the App Store and Google Play subscriptions behind ReturnSafe Pro. The RevenueCat
 * user is the Firebase uid, so a purchase follows the account to any phone. Without an API key
 * (E2E builds, a fresh checkout) billing is simply unavailable and the paywall says so.
 */
import { Linking, Platform } from 'react-native';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import { managementUrlNow, usePro } from '@/stores/pro';

export const PRO_ENTITLEMENT = 'pro';
export const YEARLY_PRODUCT = 'rs_pro_yearly';
export const MONTHLY_PRODUCT = 'rs_pro_monthly';
const ANDROID_PACKAGE = 'com.returnsafe.app';

function apiKey(): string {
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  return key?.trim() ?? '';
}

/** False when this build has no RevenueCat key for the platform. */
export function billingAvailable(): boolean {
  return apiKey().length > 0;
}

/** The Firebase uid RevenueCat is confirmed signed in as. */
let activeUid: string | null = null;
/** The uid the app wants signed in; differs from activeUid while a logIn is in flight. */
let wantedUid: string | null = null;
let configured = false;
let listening = false;

/** Stores customer info, but only while `uid` is still the signed-in, confirmed user. */
function applyCustomer(info: CustomerInfo, uid: string | null) {
  if (uid === null || uid !== activeUid || uid !== wantedUid) return;
  usePro
    .getState()
    .setCustomer(uid, PRO_ENTITLEMENT in info.entitlements.active, info.managementURL ?? null);
}

/** Updates RevenueCat pushes (renewals, refunds) are for whoever is signed in right then. */
function onCustomerInfo(info: CustomerInfo) {
  applyCustomer(info, activeUid);
}

/**
 * Signs RevenueCat in as this Firebase user (configures the SDK the first time). The user counts
 * as signed in only once logIn succeeds; after a failure the next call tries again.
 */
export async function startPurchases(uid: string): Promise<void> {
  if (!billingAvailable()) return;
  wantedUid = uid;
  if (activeUid === uid) return;
  if (!configured) {
    Purchases.configure({ apiKey: apiKey(), appUserID: uid });
    configured = true;
    activeUid = uid;
    if (!listening) {
      Purchases.addCustomerInfoUpdateListener(onCustomerInfo);
      listening = true;
    }
    applyCustomer(await Purchases.getCustomerInfo(), uid);
    return;
  }
  activeUid = null;
  const { customerInfo } = await Purchases.logIn(uid);
  // Another account signed in (or the user signed out) while this was in flight.
  if (wantedUid !== uid) return;
  activeUid = uid;
  applyCustomer(customerInfo, uid);
}

/** Signed out: forget the user's Pro on this phone. */
export async function stopPurchases(): Promise<void> {
  wantedUid = null;
  usePro.getState().reset();
  if (!configured || activeUid === null) return;
  activeUid = null;
  // Fails when RevenueCat already has no signed-in user; there is nothing to undo then.
  await Purchases.logOut().catch(() => undefined);
  usePro.getState().reset();
}

/** One plan on the paywall, with everything shown taken from the store. */
export type Plan = {
  pkg: PurchasesPackage;
  period: 'year' | 'month';
  /** "$19.99" */
  price: string;
  priceValue: number;
  /** "$1.67" for the yearly plan. */
  perMonth: string | null;
  /** Free trial length in days, when the user can still get it. */
  trialDays: number | null;
};

export type Plans = { yearly: Plan | null; monthly: Plan | null };

function trialDays(pkg: PurchasesPackage): number | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const n = intro.periodNumberOfUnits;
  switch (intro.periodUnit) {
    case 'DAY':
      return n;
    case 'WEEK':
      return n * 7;
    case 'MONTH':
      return n * 30;
    case 'YEAR':
      return n * 365;
    default:
      return null;
  }
}

function toPlan(pkg: PurchasesPackage, period: Plan['period'], eligible: boolean): Plan {
  return {
    pkg,
    period,
    price: pkg.product.priceString,
    priceValue: pkg.product.price,
    perMonth: period === 'year' ? pkg.product.pricePerMonthString : null,
    trialDays: eligible ? trialDays(pkg) : null,
  };
}

/** The "default" offering's yearly and monthly plans, priced by the store. */
export async function loadPlans(): Promise<Plans> {
  if (!billingAvailable()) throw new Error('billing-unavailable');
  const offerings = await Purchases.getOfferings();
  const offering = offerings.all.default ?? offerings.current;
  const find = (id: string, fallback: PurchasesPackage | null | undefined) =>
    offering?.availablePackages.find((p) => p.product.identifier.split(':')[0] === id) ??
    fallback ??
    null;
  const yearly = find(YEARLY_PRODUCT, offering?.annual);
  const monthly = find(MONTHLY_PRODUCT, offering?.monthly);
  // Android only offers a trial to people who can still get it. iOS has to be asked, and the
  // trial is shown only when Apple says ELIGIBLE (not on UNKNOWN or an error).
  const eligible = new Set<string>();
  const withTrial = [yearly, monthly].filter((p): p is PurchasesPackage => !!p && !!trialDays(p));
  if (Platform.OS !== 'ios') withTrial.forEach((p) => eligible.add(p.product.identifier));
  else if (withTrial.length > 0) {
    const status = await Purchases.checkTrialOrIntroductoryPriceEligibility(
      withTrial.map((p) => p.product.identifier),
    ).catch(() => ({}) as Record<string, { status: INTRO_ELIGIBILITY_STATUS }>);
    for (const p of withTrial) {
      const s = status[p.product.identifier]?.status;
      if (s === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE)
        eligible.add(p.product.identifier);
    }
  }
  const plan = (pkg: PurchasesPackage | null, period: Plan['period']) =>
    pkg ? toPlan(pkg, period, eligible.has(pkg.product.identifier)) : null;
  return { yearly: plan(yearly, 'year'), monthly: plan(monthly, 'month') };
}

/** "SAVE 44%": the yearly plan against twelve months of the monthly one. */
export function yearlySavings(plans: Plans): number | null {
  if (!plans.yearly || !plans.monthly || plans.monthly.priceValue <= 0) return null;
  const pct = Math.floor((1 - plans.yearly.priceValue / (plans.monthly.priceValue * 12)) * 100);
  return pct > 0 ? pct : null;
}

export type PurchaseResult = 'pro' | 'cancelled' | 'pending' | 'failed';

function errorCode(e: unknown): string | undefined {
  return (e as { code?: string } | null)?.code;
}

/** Buys a plan. Cancelling the store sheet is not an error. */
export async function buy(plan: Plan): Promise<PurchaseResult> {
  const uid = activeUid;
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    applyCustomer(customerInfo, uid);
    return PRO_ENTITLEMENT in customerInfo.entitlements.active ? 'pro' : 'failed';
  } catch (e) {
    const code = errorCode(e);
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled';
    if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return 'pending';
    if ((e as { userCancelled?: boolean | null } | null)?.userCancelled) return 'cancelled';
    return 'failed';
  }
}

/** Restore purchases: true when Pro is active afterwards. */
export async function restore(): Promise<boolean> {
  if (!billingAvailable() || !configured) throw new Error('billing-unavailable');
  const uid = activeUid;
  const info = await Purchases.restorePurchases();
  applyCustomer(info, uid);
  return PRO_ENTITLEMENT in info.entitlements.active;
}

/** The store's own subscription page for this platform. */
export function manageSubscriptionUrl(managementURL: string | null): string {
  if (managementURL) return managementURL;
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`;
}

export async function openManageSubscription(): Promise<void> {
  await Linking.openURL(manageSubscriptionUrl(managementUrlNow()));
}

/** Test seam: forget that the SDK was configured. */
export function resetPurchasesForTests(): void {
  configured = false;
  activeUid = null;
  wantedUid = null;
  listening = false;
  usePro.getState().reset();
}
