/**
 * The 50 built-in US store policies. The same file seeds the read-only stores/ collection
 * (scripts/seed-stores.mjs); the app bundles it so the picker works offline.
 */
import seed from '../../../seed/stores.json';

import type { CustomStore } from './types';

export type StorePolicy = {
  id: string;
  name: string;
  aliases: string[];
  returnDays: number;
  notes: string;
  policyUrl: string;
};

export const STORES: readonly StorePolicy[] = seed.map(
  ({ id, name, aliases, returnDays, notes, policyUrl }) => ({
    id,
    name,
    aliases,
    returnDays,
    notes,
    policyUrl,
  }),
);

/** Shown in the picker before the user types. */
export const POPULAR_STORE_IDS = [
  'walmart',
  'target',
  'amazon',
  'costco',
  'best-buy',
  'home-depot',
];

/** Return windows offered for a store that is not in the list. */
export const CUSTOM_WINDOWS = [14, 30, 60, 90] as const;
export const DEFAULT_CUSTOM_WINDOW = 30;

export function storeById(id: string | null | undefined): StorePolicy | undefined {
  return id ? STORES.find((s) => s.id === id) : undefined;
}

/** Lower-case letters and digits only, so "Joe's Bikes" and "joes bikes" match. */
export function normalizeStoreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

/** Document id for a custom store window, the same for every spelling that normalises alike. */
export function customStoreId(name: string): string {
  return normalizeStoreName(name).slice(0, 40) || 'store';
}

/** The built-in store whose name or alias is exactly this name, if any. */
export function findStoreByName(name: string): StorePolicy | undefined {
  const key = normalizeStoreName(name);
  if (!key) return undefined;
  return STORES.find(
    (s) =>
      normalizeStoreName(s.name) === key || s.aliases.some((a) => normalizeStoreName(a) === key),
  );
}

export type StoreMatch =
  { kind: 'builtin'; store: StorePolicy } | { kind: 'custom'; store: CustomStore };

/** Stores whose name or alias contains the query; names that start with it come first. */
export function searchStores(query: string, custom: readonly CustomStore[]): StoreMatch[] {
  const q = normalizeStoreName(query);
  if (!q) return [];
  const score = (names: string[]) => {
    const keys = names.map(normalizeStoreName);
    if (keys.some((k) => k.startsWith(q))) return 0;
    if (keys.some((k) => k.includes(q))) return 1;
    return -1;
  };
  const builtin = STORES.map((store) => ({
    m: { kind: 'builtin', store } as StoreMatch,
    s: score([store.name, ...store.aliases]),
    name: store.name,
  }));
  const own = custom.map((store) => ({
    m: { kind: 'custom', store } as StoreMatch,
    s: score([store.name]),
    name: store.name,
  }));
  return [...own, ...builtin]
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.name.localeCompare(b.name))
    .map((x) => x.m);
}

/** "Most items · 90 days" */
export function policySummary(returnDays: number, notes?: string): string {
  const first = notes?.split('.')[0]?.trim();
  return `${first || 'Most items'} · ${returnDays} days`;
}
