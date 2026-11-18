/* global jest */
/**
 * In-memory RevenueCat (react-native-purchases) for tests. Tests set the offering, the purchase
 * outcome and the restore result through `purchasesControl`.
 */
const listeners = new Set();

const product = (identifier, price, priceString, extra = {}) => ({
  identifier,
  price,
  priceString,
  pricePerMonthString: null,
  introPrice: null,
  currencyCode: 'USD',
  ...extra,
});

const YEARLY = {
  identifier: '$rc_annual',
  packageType: 'ANNUAL',
  product: product('rs_pro_yearly', 19.99, '$19.99', {
    pricePerMonthString: '$1.67',
    introPrice: {
      price: 0,
      priceString: '$0.00',
      cycles: 1,
      period: 'P1W',
      periodUnit: 'DAY',
      periodNumberOfUnits: 7,
    },
  }),
};
const MONTHLY = {
  identifier: '$rc_monthly',
  packageType: 'MONTHLY',
  product: product('rs_pro_monthly', 2.99, '$2.99'),
};

const state = {
  packages: [YEARLY, MONTHLY],
  offeringsError: null,
  /** 'pro' | 'cancelled' | 'pending' | 'failed' */
  purchase: 'pro',
  restorePro: false,
  pro: false,
  eligible: true,
  appUserID: null,
};

const customer = () => ({
  entitlements: {
    active: state.pro ? { pro: { identifier: 'pro', isActive: true } } : {},
    all: {},
  },
  managementURL: null,
});

const PURCHASES_ERROR_CODE = { PURCHASE_CANCELLED_ERROR: '1', PAYMENT_PENDING_ERROR: '20' };
const INTRO_ELIGIBILITY_STATUS = {
  INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
  INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
  INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
};

const Purchases = {
  configure: jest.fn((c) => {
    state.appUserID = c.appUserID;
  }),
  logIn: jest.fn(async (uid) => {
    state.appUserID = uid;
    return { customerInfo: customer(), created: false };
  }),
  logOut: jest.fn(async () => {
    state.appUserID = null;
    return customer();
  }),
  getCustomerInfo: jest.fn(async () => customer()),
  addCustomerInfoUpdateListener: jest.fn((l) => listeners.add(l)),
  removeCustomerInfoUpdateListener: jest.fn((l) => listeners.delete(l)),
  getOfferings: jest.fn(async () => {
    if (state.offeringsError) throw state.offeringsError;
    const offering = {
      identifier: 'default',
      availablePackages: state.packages,
      annual: state.packages.find((p) => p.packageType === 'ANNUAL') ?? null,
      monthly: state.packages.find((p) => p.packageType === 'MONTHLY') ?? null,
    };
    return { all: { default: offering }, current: offering };
  }),
  checkTrialOrIntroductoryPriceEligibility: jest.fn(async (ids) =>
    Object.fromEntries(
      ids.map((id) => [
        id,
        {
          status: state.eligible
            ? INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
            : INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE,
        },
      ]),
    ),
  ),
  purchasePackage: jest.fn(async () => {
    if (state.purchase === 'cancelled')
      throw Object.assign(new Error('cancelled'), { code: '1', userCancelled: true });
    if (state.purchase === 'pending')
      throw Object.assign(new Error('pending'), { code: '20', userCancelled: false });
    if (state.purchase === 'failed')
      throw Object.assign(new Error('failed'), { code: '2', userCancelled: false });
    state.pro = true;
    return { customerInfo: customer(), productIdentifier: 'rs_pro_yearly' };
  }),
  restorePurchases: jest.fn(async () => {
    state.pro = state.restorePro;
    return customer();
  }),
};

function resetPurchases() {
  Object.assign(state, {
    packages: [YEARLY, MONTHLY],
    offeringsError: null,
    purchase: 'pro',
    restorePro: false,
    pro: false,
    eligible: true,
    appUserID: null,
  });
  listeners.clear();
}

const fakePurchases = {
  __esModule: true,
  default: Purchases,
  PURCHASES_ERROR_CODE,
  INTRO_ELIGIBILITY_STATUS,
};

module.exports = { fakePurchases, purchasesControl: state, resetPurchases, YEARLY, MONTHLY };
