import { defineBoolean } from 'firebase-functions/params';

/**
 * Callables reject requests without a valid App Check token (App Attest / Play Integrity) when
 * this is true. It is set to true for production in functions/.env.returnsafe-prod and stays false
 * for the dev project and the emulators, which E2E builds use without App Check.
 */
export const ENFORCE_APP_CHECK = defineBoolean('ENFORCE_APP_CHECK', {
  default: false,
  description: 'Reject callable requests that have no valid App Check token.',
});

/** Options shared by every callable function. */
export const callableOptions = { enforceAppCheck: ENFORCE_APP_CHECK };
