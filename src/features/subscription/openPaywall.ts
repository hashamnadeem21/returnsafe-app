import { router } from 'expo-router';

import type { PaywallSource } from '@/lib/telemetry';

/** Opens the paywall, telling it where it was opened from (for the paywall_view event). */
export function openPaywall(from: PaywallSource): void {
  router.push({ pathname: '/paywall', params: { from } });
}
