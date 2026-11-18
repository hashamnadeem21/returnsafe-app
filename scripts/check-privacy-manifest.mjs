// Checks the privacy manifests inside a built iOS app (Apple rejects uploads whose app or SDKs
// use "required reason" APIs without declaring them).
//
//   npm run check:privacy -- path/to/ReturnSafe.app
//
// With no path it uses the newest ReturnSafe*.app in Xcode's DerivedData. It lists every
// PrivacyInfo.xcprivacy in the bundle (app, frameworks, resource bundles), then fails when:
//  - the app's own manifest is missing, claims tracking, or lists tracking domains;
//  - an SDK on Apple's list of commonly used SDKs ships without a manifest;
//  - an API category declared by any SDK has no reason code.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, relative } from 'node:path';

// From Apple's "Third-party SDK requirements" list, limited to SDKs this app can contain.
const COMMONLY_USED_SDKS = [
  'FirebaseABTesting',
  'FirebaseAnalytics',
  'FirebaseAuth',
  'FirebaseCore',
  'FirebaseCoreDiagnostics',
  'FirebaseCoreExtension',
  'FirebaseCoreInternal',
  'FirebaseCrashlytics',
  'FirebaseFirestore',
  'FirebaseFunctions',
  'FirebaseInstallations',
  'FirebaseMessaging',
  'FirebaseSessions',
  'FirebaseStorage',
  'GoogleDataTransport',
  'GoogleSignIn',
  'GoogleUtilities',
  'GTMAppAuth',
  'GTMSessionFetcher',
  'AppAuth',
  'PromisesObjC',
  'FBLPromises',
  'nanopb',
  'leveldb',
  'abseil',
  'BoringSSL',
  'gRPC',
  'RevenueCat',
  'SDWebImage',
];

function newestApp() {
  const derived = join(homedir(), 'Library/Developer/Xcode/DerivedData');
  if (!existsSync(derived)) return null;
  const apps = [];
  for (const dir of readdirSync(derived).filter((d) => d.startsWith('ReturnSafe'))) {
    const products = join(derived, dir, 'Build/Products');
    if (!existsSync(products)) continue;
    for (const config of readdirSync(products)) {
      for (const entry of readdirSync(join(products, config))) {
        if (entry.endsWith('.app')) apps.push(join(products, config, entry));
      }
    }
  }
  apps.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return apps[0] ?? null;
}

function findManifests(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) findManifests(path, out);
    else if (entry.name === 'PrivacyInfo.xcprivacy') out.push(path);
  }
  return out;
}

const readPlist = (path) =>
  JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path], { encoding: 'utf8' }));

/** "Frameworks/FirebaseCore.framework/..." or ".../GoogleUtilities_Privacy.bundle/..." → its name. */
function ownerOf(app, manifest) {
  const rel = relative(app, manifest);
  if (rel === 'PrivacyInfo.xcprivacy') return '(app)';
  const part = rel.split('/').find((p) => p.endsWith('.framework') || p.endsWith('.bundle'));
  return (part ?? rel).replace(/\.(framework|bundle)$/, '').replace(/_Privacy$/, '');
}

const app = process.argv[2] ?? newestApp();
if (!app || !existsSync(app)) {
  console.error('No .app found. Build the app first or pass the path to a built .app.');
  process.exit(1);
}
console.log(`Checking ${app}\n`);

const problems = [];
const owners = new Set();
const categories = new Map(); // category -> Set(owner)
for (const manifest of findManifests(app).sort()) {
  const owner = ownerOf(app, manifest);
  owners.add(owner);
  const plist = readPlist(manifest);
  const apis = plist.NSPrivacyAccessedAPITypes ?? [];
  const summary = apis
    .map(
      (a) =>
        `${a.NSPrivacyAccessedAPIType.replace('NSPrivacyAccessedAPICategory', '')}(${(a.NSPrivacyAccessedAPITypeReasons ?? []).join(',')})`,
    )
    .join(' ');
  console.log(`  ${owner.padEnd(34)} ${summary || '-'}`);
  for (const a of apis) {
    if (!(a.NSPrivacyAccessedAPITypeReasons ?? []).length) {
      problems.push(`${owner}: ${a.NSPrivacyAccessedAPIType} has no reason code`);
    }
    const set = categories.get(a.NSPrivacyAccessedAPIType) ?? new Set();
    set.add(owner);
    categories.set(a.NSPrivacyAccessedAPIType, set);
  }
  if (owner === '(app)') {
    if (plist.NSPrivacyTracking !== false)
      problems.push('App manifest: NSPrivacyTracking must be false');
    if ((plist.NSPrivacyTrackingDomains ?? []).length)
      problems.push('App manifest lists tracking domains');
  }
}

if (!owners.has('(app)')) problems.push('The app has no PrivacyInfo.xcprivacy of its own');

// SDKs present as frameworks or static-library resource bundles.
const frameworks = existsSync(join(app, 'Frameworks'))
  ? readdirSync(join(app, 'Frameworks')).map((f) => basename(f).replace(/\.framework$/, ''))
  : [];
const bundles = readdirSync(app)
  .filter((f) => f.endsWith('.bundle'))
  .map((f) => f.replace(/\.bundle$/, '').replace(/_Privacy$/, ''));
// Static pods are linked into the app binary; their symbols show which SDKs are inside.
const binary = join(app, basename(app, '.app'));
const strings = existsSync(binary)
  ? execFileSync('strings', ['-n', '6', binary], { encoding: 'utf8', maxBuffer: 1 << 28 })
  : '';
const present = COMMONLY_USED_SDKS.filter(
  (sdk) => frameworks.includes(sdk) || bundles.includes(sdk) || strings.includes(sdk),
);
// Swift packages name their bundles "<Package>_<Target>", CocoaPods "<Pod>_<Bundle>".
const covers = (owner, sdk) =>
  owner === sdk || owner.startsWith(`${sdk}_`) || owner.endsWith(`_${sdk}`);
const missing = present.filter((sdk) => ![...owners].some((owner) => covers(owner, sdk)));
for (const sdk of missing) problems.push(`${sdk} is in the app but ships no privacy manifest`);

console.log(`\nCommonly used SDKs found: ${present.join(', ') || 'none'}`);
console.log(
  `API categories declared: ${[...categories.keys()].map((c) => c.replace('NSPrivacyAccessedAPICategory', '')).join(', ')}`,
);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nPrivacy manifests OK.');
