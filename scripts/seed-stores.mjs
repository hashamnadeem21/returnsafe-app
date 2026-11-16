#!/usr/bin/env node
/**
 * Loads seed/stores.json into the stores/{storeId} collection with the Admin SDK.
 *
 *   node scripts/seed-stores.mjs --emulator            # local Firestore emulator (127.0.0.1:8180)
 *   node scripts/seed-stores.mjs --project <id>        # a real project; needs admin credentials
 *                                                      # (GOOGLE_APPLICATION_CREDENTIALS)
 * Clients can only read this collection; the rules deny all writes.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// firebase-admin is a dependency of the functions package.
const require = createRequire(resolve(root, 'functions/package.json'));
const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const args = process.argv.slice(2);
const emulator = args.includes('--emulator');
const projectFlag = args.indexOf('--project');
const projectId =
  projectFlag >= 0 ? args[projectFlag + 1] : emulator ? 'returnsafe-app' : undefined;

if (!emulator && !projectId) {
  console.error('Pass --emulator, or --project <id> to write to a real project.');
  process.exit(1);
}
if (emulator) process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8180';

const stores = JSON.parse(readFileSync(resolve(root, 'seed/stores.json'), 'utf8'));
initializeApp({ projectId });
const db = getFirestore();
const batch = db.batch();
for (const { id, ...store } of stores) {
  batch.set(db.doc(`stores/${id}`), { ...store, updatedAt: FieldValue.serverTimestamp() });
}
await batch.commit();
const review = stores.filter((s) => s.needsReview).map((s) => s.name);
console.log(`Loaded ${stores.length} stores into ${emulator ? 'the emulator' : projectId}.`);
if (review.length) console.log(`Needs review: ${review.join(', ')}`);
