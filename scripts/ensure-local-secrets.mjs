// The Functions emulator reads secrets from functions/.secret.local (git-ignored). This adds a
// local-only webhook secret when the file doesn't set one, so the emulators and tests can start.
// Other entries, and a webhook secret already set, are left as they are.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../functions/.secret.local', import.meta.url);
const KEY = 'REVENUECAT_WEBHOOK_SECRET';
const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
const isSet = text
  .split(/\r?\n/)
  .some((l) => l.trim().startsWith(`${KEY}=`) && l.slice(l.indexOf('=') + 1).trim() !== '');
if (!isSet) {
  const sep = text === '' || text.endsWith('\n') ? '' : '\n';
  writeFileSync(file, `${text}${sep}${KEY}=local-emulator-secret\n`);
  console.log(`Added ${KEY} to functions/.secret.local for the emulators.`);
}
