# ReturnSafe — Build Prompt (Phase by Phase, Test-Gated)

Paste the **Master prompt** into Claude Code (or another coding agent) in an empty folder. Then paste **one phase prompt at a time**. Move to the next phase only when the current phase's gate report says **PASSED** on both iOS and Android.

Keep these files next to the project and give them to the agent:
- `ReturnSafe-Design.pdf` — every screen (source of truth for UI)
- `brand/` — logo and icon files
- The spec document (data model, rules, functions, use cases UC-01…UC-20, test cases TC-001…TC-801)

---

## Master prompt (paste once, at the start)

```
You are building "ReturnSafe", a React Native app for iOS and Android that tracks store return
deadlines and warranties from receipt photos. US only, English, USD. Monetised with a Pro subscription.

NON-NEGOTIABLE RULES
1. Work in PHASES. I will give you one phase at a time. Do only that phase's scope.
2. Every phase ends with a TEST GATE. Run every test listed. Report each test ID with PASS/FAIL and
   the command output. If anything fails, fix it inside the same phase and re-run the whole gate.
   Never start the next phase yourself.
3. Branch flow for EVERY phase:
   a. `git checkout main && git pull`. If the previous phase's branch is not merged yet, run its
      gate first, open its PR, merge it, pull main, and only then continue.
   b. Create a new branch from main: `phase-<N>/<short-name>` (e.g. phase-1/design-system).
   c. Do the phase's work and commit on that branch.
   d. When the whole gate passes: push the branch, open a PR into main titled
      "Phase <N>: <name>" with the GATE REPORT as its body, merge it, pull main, and tag main
      `phase-<N>-passed`. Never open a PR before the gate passes.
   Then print a GATE REPORT:
   - Phase, date, commit hash
   - Table: Test ID | Type | iOS | Android | Notes
   - Anything you could not verify (e.g. needs a real device) listed under "MANUAL CHECKS FOR YOU"
     with exact steps for me to perform.
4. No code breakage:
   - Use Expo (latest stable SDK) with development builds and `npx expo prebuild`. Never use Expo Go.
   - Install every native-capable package with `npx expo install <pkg>` so versions match the SDK.
   - Before adding any library, confirm it supports the current Expo SDK / React Native version and
     the New Architecture. If it does not, stop and propose an alternative instead of forcing it.
   - Run `npx expo-doctor` after every dependency change; it must report no problems.
   - TypeScript strict mode. `tsc --noEmit`, ESLint and Prettier must pass with zero errors.
   - Never edit ios/ or android/ by hand. All native config goes through app.config.ts and config
     plugins, so `expo prebuild --clean` always reproduces the native projects.
5. No design conflicts:
   - All colours, spacing, radii and type come from one token file (src/theme/tokens.ts). No raw hex
     values or magic numbers inside screens.
   - Light and dark themes from the same tokens. Inter font bundled.
   - Platform differences ONLY where the spec lists them (Apple button iOS-only, date picker style,
     back behaviour, paywall legal text, edge-to-edge on Android, scanner engine).
   - Tap targets >= 48x48. Every interactive element has accessibilityLabel and accessibilityRole.
   - Text uses allowFontScaling with maxFontSizeMultiplier 1.4.
6. Simple and easy: never add screens, settings or features that are not in the spec. If something
   is ambiguous, ask me one short question instead of guessing.
7. Secrets: never commit keys. Use .env (git-ignored) + EAS secrets + Firebase Functions secrets.
   Provide .env.example with every variable name.
8. Two Firebase projects: returnsafe-dev and returnsafe-prod. Default to dev. Use the Firebase
   Emulator Suite (auth, firestore, storage, functions) for all automated tests.
9. Git: in this repo only (not --global) set
   git config user.name "Muhammad Hasham Nadeem"
   git config user.email "hasham.nadeem112@gmail.com"
   Commit messages, tags, branch names and PR descriptions must contain NO reference to Claude,
   Anthropic or any AI tool: no Co-Authored-By trailers, no "Generated with" footers.
   Use Conventional Commits (feat:, fix:, test:, chore:). Never force-push to main.

STACK
- Expo SDK (latest stable), TypeScript strict, Expo Router (native stack + tabs)
- @react-native-firebase: app, auth, firestore, storage, messaging, functions, crashlytics,
  analytics, app-check
- @invertase/react-native-apple-authentication, @react-native-google-signin/google-signin
- react-native-purchases (RevenueCat)
- react-native-document-scanner-plugin + @react-native-ml-kit/text-recognition
- react-hook-form + zod, zustand, date-fns + date-fns-tz, @shopify/flash-list, @gorhom/bottom-sheet,
  react-native-safe-area-context, expo-haptics, expo-font (Inter)
- Cloud Functions: Node (LTS supported by Firebase), TypeScript, firebase-functions v2
- Tests: Jest + @testing-library/react-native, @firebase/rules-unit-testing, firebase-functions-test,
  Maestro for end-to-end flows on iOS Simulator and Android Emulator
- CI: GitHub Actions running lint, typecheck, unit, rules and functions tests on every push

IDENTIFIERS
- App name: ReturnSafe. Store listing name: "ReturnSafe: Return Reminder"
- iOS bundle ID and Android package: com.returnsafe.app
- Deep link scheme: returnsafe://
- RevenueCat entitlement: pro. Products: rs_pro_monthly ($2.99), rs_pro_yearly ($19.99, 7-day trial)

FOLDER STRUCTURE
app/                 Expo Router routes: (auth)/, (tabs)/, receipt/[id].tsx, paywall.tsx, etc.
src/theme/           tokens.ts, ThemeProvider, useTheme
src/components/      Button, TextField, Card, Chip, Pill, ListRow, Banner, Sheet, EmptyState,
                     CountdownRing, ProLock, Skeleton, ScreenHeader, TabBar
src/features/        auth/, receipts/, scan/, reminders/, subscription/, warranties/, settings/
src/lib/             firebase.ts, dates.ts (deadline maths), money.ts (cents), analytics.ts
src/stores/          session.ts (zustand), pro.ts
functions/src/       onReceiptWrite, sendDueReminders, expireReceipts, revenueCatWebhook,
                     deleteAccount, mergeGuestAccount, shared zod schemas
firestore.rules, storage.rules, firestore.indexes.json
seed/stores.json     50 US store return policies
e2e/                 Maestro flows (*.yaml), one per test ID where the type is E2E
tests/               rules/, functions/, unit/

Confirm you understand, then wait for "PHASE 0".
```

---

## Phase 0 — Foundation

```
PHASE 0 — Foundation. Scope:
1. Create the Expo app with TypeScript template. Enable strict mode. Add ESLint + Prettier.
2. app.config.ts with name, slug, scheme returnsafe, bundle ID/package com.returnsafe.app,
   ios.supportsTablet = false, android edge-to-edge, userInterfaceStyle "automatic",
   ITSAppUsesNonExemptEncryption = false, and environment switching (APP_ENV=development|production)
   that selects GoogleService-Info.plist / google-services.json for dev or prod.
3. Install @react-native-firebase/app and expo-dev-client. Add the config plugins.
   Include expo-build-properties (iOS useFrameworks: "static" as React Native Firebase requires).
4. eas.json with development (simulator + device), preview and production profiles; production
   uses autoIncrement for build numbers.
5. firebase.json with emulators: auth 9099, firestore 8080, storage 9199, functions 5001, ui 4000.
   Empty firestore.rules/storage.rules that deny everything.
6. A placeholder screen "ReturnSafe — Phase 0".
7. Jest configured with one passing smoke test. GitHub Actions workflow: install, lint, tsc, jest.
8. README with: how to run emulators, how to build dev clients, how to run tests.

TEST GATE (all must pass):
- TC-001 Manual: dev build installs and opens on iOS Simulator and Android Emulator, showing the
  placeholder, no red screen. Build both and give me the commands you used.
- TC-002: npm run lint, npx tsc --noEmit, npm test all exit 0.
- npx expo-doctor: no problems.
- npx expo prebuild --clean succeeds twice in a row with no diff in app.config.ts.
Print the GATE REPORT.
```

## Phase 1 — Design system and navigation

```
PHASE 1 — Design system and navigation. Use ReturnSafe-Design.pdf pages 2–4 and every screen page.
Scope:
1. src/theme/tokens.ts with the exact light and dark colour tokens, type scale (Display 28/34 bold,
   Title 22/28 semibold, Headline 17/22 semibold, Body 16/22, Caption 13/18, Label 12/16 medium),
   spacing (4-pt grid, screen padding 20), radii (card 16, button 14, input 12, chip full).
   Bundle Inter (400/500/600/700/800) with expo-font; hold the splash until fonts load.
2. Components listed in the master prompt, matching the PDF states: Button (primary, secondary,
   soft, danger, text, disabled, loading), TextField (default, focus, error, helper, secure toggle),
   Chip (on/off + count), Pill (red 0–2 days, amber 3–7, gray 8+, green returned, teal kept),
   ListRow with letter avatar, Banner (warn, info, offline), Sheet (bottom-sheet), EmptyState,
   CountdownRing, ProLock, Skeleton, custom TabBar with raised centre Scan button.
3. Card styling identical on both platforms: 1px border + platform shadow/elevation.
4. Expo Router: (auth) stack [onboarding, welcome, sign-up, log-in, forgot-password,
   notification-primer] and (tabs) [home, receipts, scan (opens modal), warranties, settings],
   plus receipt/[id], receipt/new, receipt/[id]/edit, paywall (modal), settings/reminders,
   settings/account, settings/delete-account. Placeholder content for screens not yet built.
5. Splash (expo-splash-screen, logo on #0F766E) and app icons from brand/:
   iOS icon app-icon-ios-1024.png; Android adaptive foreground android-adaptive-foreground-1024.png,
   background colour #0F766E, monochrome android-monochrome-1024.png.
6. Onboarding (3 cards) shown only on first launch (persist a flag in AsyncStorage/MMKV).
7. Dark mode follows the system.

TEST GATE:
- TC-101 E2E (Maestro) on both platforms: fresh install shows onboarding; after Skip and relaunch
  it is not shown again.
- TC-102 E2E: tap each tab; each screen's title is visible; Scan opens a modal.
- TC-103 Unit: Button disabled/loading does not call onPress; snapshot of each variant.
- Unit: every component renders in light and dark theme without errors.
- Unit/lint: a custom ESLint rule or grep check proves no hex colours exist outside tokens.ts.
- TC-104 / TC-105 Manual: list them under MANUAL CHECKS FOR YOU with exact steps.
Print the GATE REPORT.
```

## Phase 2 — Login and signup

```
PHASE 2 — Login and signup. Spec section "Login and signup" and screens S03–S07, S18, S19.
Scope:
1. Firebase Auth: email/password, Apple (iOS only; Apple button hidden on Android),
   Google (both), anonymous guest.
2. Welcome (S03), Sign up (S04), Log in (S05), Forgot password (S06), Notification primer (S07,
   UI only now; permission wiring comes in Phase 5).
3. Validation with zod: email format, password >= 8 chars with a number. Friendly error mapping for
   every Firebase auth error code (wrong password and unknown user produce the SAME message;
   reset always shows the neutral message; account-exists-with-different-credential shows which
   provider to use).
4. Apple: request full name + email; store the name on first sign-in only.
5. Guest -> real account with linkWithCredential (uid unchanged). If the credential is already in
   use, offer to sign in to that account and call mergeGuestAccount (Cloud Function, stub OK now,
   implemented in Phase 3).
6. On first sign-in create users/{uid} with defaults (reminderHour 9, reminderDays [7,3,1] (Free users still get only the 1-day reminder; the server enforces it),
   timezone from the device, activeCount 0, isPro false — isPro written by server only;
   do it via a callable or onCreate trigger, not from the client).
7. Auth gate in the root layout: signed out -> (auth); signed in -> (tabs). Sign out clears caches
   and resets navigation so back cannot return to Home.
8. Account screen (S18) with guest "save your account" options, Sign out, Delete account.
   Delete account (S19): type DELETE, re-auth when required, call deleteAccount function which
   removes Firestore user data, Storage files and the auth user.
9. Firestore rules for users/{uid}: owner-only; isPro/proExpiresAt not client-writable.
10. Enable App Check in debug mode for dev builds.

TEST GATE:
- TC-201, TC-203, TC-204, TC-205, TC-208, TC-209, TC-210 as Maestro flows against the auth emulator,
  on iOS Simulator and Android Emulator.
- TC-202 unit test of the zod schema and the TextField error.
- TC-211 functions test: deleteAccount removes everything.
- Rules tests: user can read/write own doc; cannot read another user; cannot set isPro.
- TC-206, TC-207, TC-212 under MANUAL CHECKS FOR YOU (real device steps).
Print the GATE REPORT.
```

## Phase 3 — Receipts core

```
PHASE 3 — Receipts core. Spec sections Features, Architecture (data model, rules), screens S08,
S10 (manual mode), S11, S12, S13, S21, limit sheet.
Scope:
1. seed/stores.json with 50 major US retailers: id, name, aliases[], returnDays, notes, policyUrl.
   IMPORTANT: verify each returnDays value against the retailer's official return-policy page and
   store that URL in policyUrl. If you cannot verify one, mark it "needsReview": true and list it
   in the gate report. Script to load it into the emulator and into Firestore (admin only).
2. src/lib/dates.ts: computeDeadline(purchaseDate, returnDays) using calendar days in the user's
   time zone; daysLeft(); reminderInstants(deadline, reminderDays, reminderHour, timezone) -> UTC
   instants, correct across daylight-saving changes (use date-fns-tz).
3. src/lib/money.ts: parse/format USD, store integer cents.
4. Receipt form (shared by new, review and edit): store picker sheet with search + custom store
   (remember custom window per store name in users/{uid}/customStores), purchase date (iOS inline
   calendar in a sheet, Android Material dialog), total, items, deadline card with "Change".
5. Home (S08): money protected (sum of active), money saved (sum of returned), Due soon and Later
   lists, empty state, reminders-off banner placeholder.
6. Receipts (S13): search (store name and items), filter chips with counts, grouped list,
   FlashList.
7. Receipt detail (S12): countdown ring (red 0–2 days, amber 3–7), items, photo placeholder,
   Returned (adds to money saved, 5-second Undo snackbar), Keep it, Edit, Delete (confirm).
8. Offline: Firestore persistence on; show "Waiting to sync" for pending writes
   (metadata.hasPendingWrites).
9. Free limit: users/{uid}.activeCount maintained by onReceiptWrite (Cloud Function). Rules deny
   creating an active receipt when !isPro && activeCount >= 5. App checks first and shows the
   limit sheet (paywall link is a stub until Phase 6).
10. Implement mergeGuestAccount.
11. Firestore rules for receipts with field validation (types, amountCents 1..9,999,999,
    storeName 1..80 chars, <= 50 items, <= 5 photoPaths) and composite indexes.

TEST GATE:
- TC-301, TC-302, TC-303, TC-313 unit tests (+ at least 15 more date cases: month ends, Feb 29,
  DST start/end in New York, Chicago, Denver, Los Angeles, Phoenix, Honolulu).
- TC-304, TC-305, TC-306 rules tests; plus one test per rule (allow and deny cases).
- TC-307, TC-308, TC-309, TC-310, TC-311, TC-314 Maestro flows on both platforms.
- Functions test: onReceiptWrite keeps activeCount correct for create/update/delete/status change.
- TC-312 under MANUAL CHECKS FOR YOU.
- List any store policies marked needsReview.
Print the GATE REPORT.
```

## Phase 4 — Scanning and photos

```
PHASE 4 — Scanning and photos. Screens S09, S10 (scan mode).
Scope:
1. Scanner: react-native-document-scanner-plugin (VisionKit on iOS, ML Kit Document Scanner on
   Android), single page, auto-capture. Fallback: pick from photo library.
2. Text recognition with @react-native-ml-kit/text-recognition on the cropped image.
3. src/features/scan/parseReceipt.ts (pure function, no React):
   - store: match against stores.aliases (case-insensitive, fuzzy within 1–2 edits)
   - date: US formats MM/DD/YYYY, MM/DD/YY, M/D/YYYY, "Nov 12, 2026"; reject future dates
   - total: the amount next to TOTAL / AMOUNT DUE / BALANCE, excluding SUBTOTAL and TAX
   - items: lines with a trailing price (best effort)
4. Review screen pre-filled; "Detected" badge on fields found by the parser; "We couldn't read this
   receipt" path opens the manual form with the photo attached.
5. Photo upload to Storage users/{uid}/receipts/{receiptId}/{photoId}.jpg, compressed to max
   2000px / ~80% JPEG, resumable with retry when offline; no duplicates (idempotent photoId).
6. Permissions: iOS NSCameraUsageDescription and NSPhotoLibraryUsageDescription set via config
   ("ReturnSafe uses the camera to scan your receipts."). Denied -> explanation + Open Settings +
   Enter manually.
7. Storage rules: owner only, image/* only, < 10 MB.

TEST GATE:
- TC-401: create tests/fixtures/receipts/*.txt with 30 realistic OCR outputs (varied stores and
  formats, some messy) and expected values. Parser accuracy: store >= 80%, date >= 90%,
  total >= 85%. Print the accuracy table.
- TC-406 Storage rules tests (size, type, owner).
- Unit: upload queue retries and does not duplicate.
- TC-402, TC-403, TC-404, TC-405 under MANUAL CHECKS FOR YOU with exact steps (real iPhone and
  real Android phone).
Print the GATE REPORT.
```

## Phase 5 — Reminders

```
PHASE 5 — Reminders. Screens S07 (wiring), S17, notification tap.
Scope:
1. @react-native-firebase/messaging: request permission after the primer only. iOS: APNs key in
   Firebase. Android 13+: POST_NOTIFICATIONS runtime permission. Android channel
   "return-reminders" (high importance). Save/refresh FCM tokens in users/{uid}.fcmTokens.
2. Functions:
   - onReceiptWrite: (re)build reminders/{id} rows for the receipt: Free -> 1 day before;
     Pro -> user's reminderDays (default 7,3,1); at reminderHour in the user's timezone; skip
     instants in the past; delete unsent rows when status != active or receipt deleted.
     Warranty reminders 30 days before warrantyEnd (Pro only).
   - sendDueReminders (every 15 min): send due rows via FCM with data {receiptId}, mark sent,
     remove invalid tokens.
   - expireReceipts (daily): active receipts past deadline -> expired.
   - When isPro or reminder settings change, rebuild that user's reminder rows.
3. Notification text: "<Store> return closes in <N> days" / body "$<amount> · <items>".
4. Tap handling from killed, background and foreground states opens receipt/[id]
   (fall back to Home if it no longer exists).
5. Reminder settings (S17): toggle, time of day, days-before chips (7 and 3 locked for Free),
   system permission status with Open Settings.
6. Home banner when notifications are disabled.

TEST GATE:
- TC-503, TC-504, TC-506, TC-507 functions tests in the emulator.
- TC-508 and DST unit tests for reminder instants (New York, Chicago, Los Angeles; DST start and end).
- Unit: notification payload formatting.
- TC-501, TC-502, TC-505 under MANUAL CHECKS FOR YOU (real devices; include how to trigger a
  reminder 2 minutes in the future for testing).
Print the GATE REPORT.
```

## Phase 6 — Subscriptions and Pro features

```
PHASE 6 — Subscriptions and Pro. Screens S14, S15, S20, limit sheet wiring.
Scope:
1. RevenueCat: configure with platform API keys; appUserID = Firebase uid (logIn after auth,
   logOut on sign out). Entitlement "pro". Offering "default" with rs_pro_yearly (7-day trial) and
   rs_pro_monthly. Give me exact App Store Connect and Google Play Console setup steps
   (subscription group, base plans, trial offer, prices, US availability).
2. Paywall (S15) matching the PDF: yearly selected by default, prices from the store (never
   hard-coded), trial text, auto-renew and cancellation text, platform-specific "charged to"
   text, Restore, Terms and Privacy links. Handles cancelled, pending and failed purchases
   without error dialogs for cancel.
3. revenueCatWebhook (HTTPS, verify Authorization header secret): INITIAL_PURCHASE, RENEWAL,
   UNCANCELLATION, PRODUCT_CHANGE -> isPro true + proExpiresAt; CANCELLATION -> keep Pro until
   expiry; EXPIRATION -> isPro false; BILLING_ISSUE -> keep Pro through grace period.
   Idempotent by event id.
4. Client Pro state = RevenueCat customerInfo (instant UI) but all server limits read isPro from
   Firestore (source of truth for rules and functions).
5. Gating: 6th active receipt, warranties, reminder days 7/3, extra photos (>1), export.
6. Warranties tab (S14): Pro list sorted by end date + 4-month warning banner; Free locked state.
   Add warranty (months) on the receipt form.
7. Export (S20): PDF (expo-print, one receipt per page with photo) and CSV, shared via share sheet.
8. Settings (S16): plan status, Restore purchases, Manage subscription (opens the correct store
   page per platform).

TEST GATE:
- TC-604, TC-605, TC-609 + one functions test per webhook event type, including duplicate events.
- Rules test: client cannot write isPro; free limit holds even if the client skips the UI check.
- TC-607 Maestro flow on both platforms.
- Unit: export CSV columns and escaping.
- TC-601, TC-602, TC-603, TC-606, TC-608 under MANUAL CHECKS FOR YOU (Apple sandbox account and
  Google Play license tester; include how to create them).
Print the GATE REPORT.
```

## Phase 7 — Polish and release prep

```
PHASE 7 — Polish and release prep.
Scope:
1. Every screen: empty, loading (skeleton), error (Retry) and offline states as in the PDF.
2. Accessibility pass: labels, roles, focus order, 1.4x font scale, contrast; VoiceOver/TalkBack
   friendly countdown ("2 days left to return Target receipt").
3. Dark mode audit of every screen.
4. Crashlytics + Analytics events (no personal data): onboarding_complete, sign_up(method),
   receipt_added(source scan|manual), receipt_returned, paywall_view(source), purchase_start,
   purchase_success.
5. App Check enforced for Firestore, Storage and Functions in prod (App Attest / Play Integrity).
6. iOS privacy manifest: confirm every SDK's required-reason entries are present in the build.
7. EAS Update with runtimeVersion policy "appVersion"; document how to ship a JS-only fix.
8. Legal and support: generate privacy policy, terms of use (13+, auto-renewal terms) and support
   page drafts for getreturnsafe.com, plus the /delete-account web page text.
   Mark them "review with a lawyer before publishing".
9. Store listing drafts: name, subtitle, description, keywords, promotional text, screenshot
   captions (6.9" iPhone, Android phone), Play feature graphic spec, App Privacy answers,
   Play Data safety answers, App Review notes with demo account steps.
10. Production builds (eas build --profile production) for both platforms; TestFlight and Google
    Play closed testing track (12+ testers for 14 days for personal developer accounts).

TEST GATE:
- TC-702: the FULL Maestro suite passes on iOS Simulator and Android Emulator (run twice; no
  flaky failures).
- All unit, rules and functions tests pass; coverage >= 80% for src/lib and functions/src.
- npx expo-doctor clean; production builds succeed for both platforms.
- TC-701, TC-703, TC-704, TC-705, TC-706 under MANUAL CHECKS FOR YOU.
- Launch checklist from the spec: list every item with done / not done.
Print the GATE REPORT.
```

## Phase 8 — Launch

```
PHASE 8 — Launch.
Scope:
1. Final production builds with prod Firebase and RevenueCat keys; verify the app points to prod.
2. Submit: App Store (phased release on) and Google Play (staged rollout 20%).
3. Post-launch monitoring plan: Crashlytics crash-free users >= 99.5%, RevenueCat purchase
   events, Firebase budget alerts, Firestore daily export backups.
4. Rollback plan: EAS Update rollback for JS issues; halt staged rollout / pause phased release
   for native issues.

TEST GATE:
- TC-801 on the store-distributed builds (TestFlight and Play internal track): sign in, scan,
  receive a reminder, open paywall with live prices.
- Both stores approved; Android rollout moved to 100% after 3 days with crash-free >= 99.5%.
Print the FINAL REPORT.
```

---

## Prompt to use when a gate fails

```
The Phase <N> gate failed on <test IDs> (<platform>). Here is the output: <paste>.
Find the root cause, fix it without changing scope or touching other phases' code unless required,
add a regression test for it, and re-run the ENTIRE Phase <N> gate. Print the GATE REPORT again.
```

## Prompt to use after you upgrade Expo SDK later

```
Upgrade to Expo SDK <version> following the official upgrade guide. Run npx expo install --fix,
npx expo-doctor, prebuild --clean, then re-run the gates of Phases 1–7 (automated parts).
Report every failure and fix before finishing.
```
