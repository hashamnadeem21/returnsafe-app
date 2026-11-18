// The Functions emulator reads secrets from functions/.secret.local (git-ignored). This creates it
// with a local-only webhook secret when it is missing, so the emulators and tests can start.
import { existsSync, writeFileSync } from 'node:fs';

const file = new URL('../functions/.secret.local', import.meta.url);
if (!existsSync(file)) {
  writeFileSync(file, 'REVENUECAT_WEBHOOK_SECRET=local-emulator-secret\n');
  console.log('Created functions/.secret.local for the emulators.');
}
