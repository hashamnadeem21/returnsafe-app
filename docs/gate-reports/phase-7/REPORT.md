# Phase 7 — Polish and release prep: gate report

**Result:** PASSED (automated). The full Maestro suite passed twice on each platform. TC-701, TC-703, TC-704, TC-705 and TC-706, and the production builds, need real devices or your accounts; they are listed under Manual checks. **Date:** 2026-11-18 · **Branch:** `phase-7/release-prep`

## What was built

- **Empty, loading, error and offline states:**
  - A dark "You're offline. Changes are saved and will sync when you're back online." banner (design's wifiOff banner) on Home, Receipts, Warranties and receipt detail. It is driven by `@react-native-community/netinfo` (`src/lib/network.ts`); unknown reachability counts as online.
  - Receipt detail and edit now show the list skeleton while receipts load and **Retry** when loading fails, instead of "Receipt not found".
  - Render errors show Expo Router's retry screen and are reported to Crashlytics.
- **Accessibility:**
  - Spoken countdowns: rows and the detail ring read "2 days left to return Target receipt", "Last day to return …", "… returned", or "… waiting to sync".
  - **Audit test:** a test renders 20 screens (Free and Pro, signed in and out) and fails on any pressable without a role and a label.
  - **Contrast tokens:** three AA-contrast tokens were added: `dangerText`, `successText` (red and green pills) and `placeholder` (input placeholders). Every text pair in both palettes is checked at 4.5:1 and UI elements at 3:1.
  - Text already scales to 1.4× (`maxFontSizeMultiplier`).
- **Dark mode audit:**
  - **Bug fixed:** React Navigation had no theme, so its default light colours (`#F2F2F2` background, iOS blue) showed behind screens and modals in dark mode. The stack is now wrapped in a navigation theme built from the palette.
  - **Audit test:** a test renders every screen in dark mode and fails on any colour outside the dark palette.
- **Crashlytics and Analytics with no personal data** (`src/lib/telemetry.ts`):
  - **Events:** exactly `onboarding_complete`, `sign_up(method)`, `receipt_added(source scan|manual)`, `receipt_returned`, `paywall_view(source)`, `purchase_start(plan)` and `purchase_success(plan)`. They are typed, so no other parameter can be sent.
  - **Paywall sources:** every paywall entry point passes its source (settings, limit, warranties, warranty, photos, reminders, export).
  - **Collection is off by default** in `firebase.json`. It turns on only in release builds that don't use the emulators. Ad-ID, SSAID and IDFV collection, ad personalisation and automatic screen reporting are all off.
  - **No IDFA:** iOS Analytics is built without ad-ID support, so it has no IDFA and needs no ATT prompt.
- **App Check:**
  - **App:** the existing App Attest / Play Integrity setup is unchanged.
  - **Callable functions:** `initUser`, `mergeGuestAccount` and `deleteAccount` take `enforceAppCheck` from the `ENFORCE_APP_CHECK` param. It is `true` only for **returnsafe-prod** (`functions/.env.returnsafe-prod`, committed, not a secret), and `false` for the dev project and the emulators.
  - **Firestore and Storage:** enforcement is a console switch; the steps are in [docs/releasing.md](../../releasing.md#12-production-firebase-project).
- **iOS privacy manifest:**
  - **Check script:** `npm run check:privacy -- <app>` lists every `PrivacyInfo.xcprivacy` in a built app. It fails if the app's own manifest is missing or claims tracking, if an SDK on Apple's commonly-used list has no manifest, or if any API category has no reason.
  - **SDWebImage fix:** the check found that SDWebImage, linked as a prebuilt XCFramework by `expo-image-manipulator`, had no manifest, which App Store Connect rejects (ITMS-91061). `expo-image-manipulator` is now built from source (`expo.autolinking.ios.buildFromSource`), so SDWebImage comes from its pod, which includes its manifest. After the change, `npm run check:privacy` passes on the Release build: the app's own manifest is present, and FirebaseCore, FirebaseCoreExtension, FirebaseCoreInternal, FirebaseInstallations, GoogleSignIn, GoogleUtilities, GTMAppAuth, GTMSessionFetcher, AppAuth, FBLPromises, RevenueCat and SDWebImage each ship one.
- **EAS Update:**
  - `runtimeVersion: { policy: 'appVersion' }`, and `expo-updates` is installed.
  - Each EAS build profile has a channel.
  - Updates turn on once `EAS_PROJECT_ID` is set.
  - How to ship a JavaScript-only fix, roll back, and stage a rollout is in [docs/releasing.md](../../releasing.md#3-shipping-a-javascript-only-fix-eas-update).
  - `app.config.ts` also reads the EAS file secrets `GOOGLE_SERVICES_PLIST` and `GOOGLE_SERVICES_JSON`, so production cloud builds get the git-ignored Firebase files.
- **Settings:** the design's **Help and support** and **Privacy and terms** rows, plus "Version 1.0.0 (build)" (`expo-application`). The legal links now point to getreturnsafe.com, the spec's domain; they previously pointed to returnsafe.app.
- **Legal and support drafts** (each marked "review with a lawyer before publishing"):
  - [Privacy Policy](../../legal/privacy-policy.md)
  - [Terms of Use](../../legal/terms-of-use.md) (13+, auto-renewal, trial and cancellation terms, Apple EULA terms)
  - [Support page](../../legal/support.md)
  - [/delete-account page](../../legal/delete-account.md)
- **Store listing drafts:**
  - [Listing](../../store/listing.md): name, subtitle, description, keywords, promotional text, 6.9" iPhone and Android screenshot captions, and the feature graphic spec.
  - [App Privacy and Data safety answers](../../store/privacy-answers.md).
  - [App Review notes and demo account steps](../../store/review-notes.md).
- **Coverage tooling:**
  - **App:** `npm run coverage` enforces 80% on src/lib (now run in CI).
  - **Functions:** `npm run coverage:functions` measures functions/src across both the unit tests and the code running inside the Functions emulator. Both run the compiled `lib/` with V8 coverage, mapped back to `src/` through source maps.

## Results

| Test ID | Type | iOS | Android | Notes |
| ------- | ---- | --- | ------- | ----- |
| TC-702 | E2E (Maestro) | Pass | Pass | Full suite, run twice per platform: iOS 20/20 (10m 52s) and 20/20 (9m 39s); Android 20/20 (14m 34s) and 20/20 (14m 23s). No flaky failures. Dark mode on a Release build: [iOS](ios-dark-home.png), [Android](android-dark-home.png) |
| G7-1 | Unit | Pass | Pass | Dark mode audit: 20 screens in dark mode use only dark-palette colours |
| G7-2 | Unit | Pass | Pass | Accessibility audit: every control on 20 screens has a role and a label; spoken countdowns |
| G7-3 | Unit | Pass | Pass | Contrast: every text pair ≥ 4.5:1 and UI element ≥ 3:1 in both themes; letter avatars ≥ 4.5:1 |
| G7-4 | Unit | Pass | Pass | Offline banner appears and clears on 4 screens; skeleton then Retry on receipt detail; Retry on lists |
| G7-5 | Unit | Pass | Pass | Analytics: nothing sent until enabled; the 7 events with only name/method/source/plan; a full funnel (manual receipt, paywall from Settings, purchase) sends no store, amount, email or path; SDK failures never throw |
| G7-6 | Unit | Pass | Pass | Settings Help and Privacy rows open the right pages; version label |
| G7-7 | Coverage | Pass | Pass | src/lib: 98.7% statements, 86.8% branches, 100% functions, 100% lines. functions/src: 93.3% statements, 85.1% branches, 94.3% functions, 96.3% lines |
| G7-8 | Static | Pass | Pass | ESLint, TypeScript strict (app and functions), Prettier, colour check, expo-doctor 20/20 |
| G7-9 | Privacy manifest | Pass | n/a | `npm run check:privacy` on the Release build |
| TC-701 | Manual | — | — | VoiceOver / TalkBack add a receipt (see below) |
| TC-703 | Manual | — | — | iPhone SE and 360 dp Android (see below) |
| TC-704 | Manual | — | — | Cold start on a mid-range Android phone (see below) |
| TC-705 | Manual | — | — | Firestore without App Check is rejected (see below) |
| TC-706 | Manual | — | — | EAS Update for another runtimeVersion is ignored (see below) |
| Production builds | Manual | — | — | Need your EAS login and Apple credentials (see below) |

**Totals:**
- **Unit:** 18 suites, 349 tests, 7 snapshots.
- **Rules and functions:** 6 files, 97 tests, run against the Auth, Firestore, Storage and Functions emulators.
- **Maestro:** 20 flows × 2 runs on the iPhone 17 Pro Max simulator (iOS 26.2) and 20 × 2 on the Medium Phone API 36.1 emulator. These were Release builds with `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`, made after a clean prebuild (new native modules: Crashlytics, Analytics, NetInfo, expo-updates, expo-application).

## Manual checks for you

### Production builds, TestFlight and closed testing (needs your accounts)

These couldn't run here: the EAS CLI isn't logged in, the **returnsafe-prod** Firebase project doesn't exist yet, and production iOS signing needs your Apple account. Follow [docs/releasing.md](../../releasing.md) sections 1 and 2:

1. `eas login`, then `eas init`, then set `EAS_PROJECT_ID` in EAS env (all environments).
2. Create **returnsafe-prod** and upload its Firebase files as the EAS file secrets `GOOGLE_SERVICES_PLIST` and `GOOGLE_SERVICES_JSON`, then deploy rules and functions.
3. Build:
   ```bash
   eas build --profile production --platform all
   ```
   **Pass if** both builds succeed.
4. Submit to TestFlight:
   ```bash
   eas submit --platform ios --latest
   ```
5. On Android, upload the AAB by hand to a new **Closed testing** track and invite 12+ testers for 14 days.

### TC-701: screen reader adds a receipt

1. On a real iPhone, turn on VoiceOver (Settings › Accessibility › VoiceOver). On an Android phone, turn on TalkBack.
2. From Home, swipe through every element, then add a receipt with **Enter manually**: choose a store, type an amount, and save.
3. **Pass if:**
   - every control is announced with a name and a role (button, link, tab, text field);
   - the countdown is read as, for example, "29 days left to return Target receipt";
   - the receipt saves without leaving the screen reader.

### TC-703: small screens

1. Run the app on an iPhone SE (3rd generation) simulator or device, and on an Android emulator 360 dp wide (for example a Pixel 4a profile with Display size "Default"). Also try iOS Text Size at the largest non-accessibility size.
2. Visit every tab, the receipt form, the paywall and Settings.
3. **Pass if** no text or button is clipped, and the Save and Log in buttons stay above the keyboard while typing.

### TC-704: cold start under 2.5 s

1. Install a **release** build on a mid-range Android phone (for example a Pixel 6a or a Galaxy A54), signed in with a few receipts.
2. Force-stop the app, then run:
   ```bash
   adb shell am start -W -n com.returnsafe.app/.MainActivity
   ```
   Repeat 3 times.
3. **Pass if** `TotalTime` is under 2500 ms and Home is visible with receipts by then. Also time it by eye from the tap to Home.

### TC-705: App Check rejects scripted access

1. In **returnsafe-prod**, enforce App Check for Cloud Firestore (Firebase console › App Check › APIs › Cloud Firestore › Enforce). Wait 15 minutes.
2. Get an ID token for a test user, for example from the REST sign-in endpoint with the project's web API key, then read that user's document with no App Check header:
   ```bash
   curl -s -H "Authorization: Bearer $ID_TOKEN" "https://firestore.googleapis.com/v1/projects/returnsafe-prod/databases/(default)/documents/users/$UID"
   ```
3. **Pass if** the response is `403` with "Missing or invalid App Check token" (or `PERMISSION_DENIED` naming App Check), while the production app on a real device still loads receipts.
4. Optional: call `initUser` with `curl` the same way; with `ENFORCE_APP_CHECK=true` it returns `401 UNAUTHENTICATED`.

### TC-706: an update for another runtime version is ignored

Use the dedicated **runtime-test** channel (the `runtime-test` profile in `eas.json`). Only the build made for this test listens to it, so the test bundles never reach production or preview users.

1. Build version **1.0.0** with `eas build --profile runtime-test --platform ios` (or `android`) and install it on a device. Open it once while online.
2. **Control (required):** change a visible string (for example the Home title to "TC-706 control") with `version` still 1.0.0, then:
   ```bash
   eas update --channel runtime-test --message "TC-706 control 1.0.0"
   ```
   Fully close and reopen the app twice. The control title must show. If it doesn't, the device isn't receiving updates; fix that first, because the next step can't prove anything.
3. **Test:** set `version: '1.0.1'` in `app.config.ts`, change the title to "TC-706 runtime 1.0.1", then:
   ```bash
   eas update --channel runtime-test --message "TC-706 runtime 1.0.1"
   ```
4. Fully close and reopen the app twice.
5. **Pass if** step 2 showed the control title and it still shows now, not the 1.0.1 title: the 1.0.0 build ignored the update for another runtime. Expo dashboard › Updates shows the runtime versions 1.0.0 and 1.0.1.
6. Clean up: revert the local changes (don't commit them), delete both test update groups (`eas update:list --branch runtime-test`, then `eas update:delete <group-id>`), and uninstall the test build.

## Launch checklist

Status of every item in the spec's launch checklist. **Done** means it is in the code or docs and verified here. **Not done** means it needs your accounts, real devices, or time, with the next step named.

| Item | Status | Where / next step |
| --- | --- | --- |
| App idea and name check (App Store, Google Play) | Done | Ticked in the spec; recheck name availability when creating the store records |
| Logo and app icons for iOS and Android | Done | `docs/brand/`, Phase 1 |
| Complete screen design (design PDF) | Done | `docs/design/` |
| Use cases and test cases | Done | Spec doc |
| Login and signup methods | Done | Phase 2 (email, Apple, Google, guest) |
| iOS and Android built and tested from one codebase | Done | Every gate run on both platforms |
| No code breakage: every phase passes its gate | Done | Tags `phase-0-passed` … `phase-6-passed`; this report |
| No design conflicts: one token set | Done | `src/theme/tokens.ts`; colour check in CI; dark-mode audit test |
| First receipt in under 60 s (timed with 5 people) | Not done | Needs 5 people on a TestFlight / closed-test build |
| Apple Developer Program and Google Play Console accounts | Not done | Your accounts (D-U-N-S for a company account) |
| Paid Apps agreement, tax, bank; Play payments profile | Not done | `docs/subscriptions-setup.md` §1–2 |
| Apple Small Business Program; Play 15% rate | Not done | Enrol in App Store Connect; check Play's rate |
| Google closed test: 12+ testers for 14 days | Not done | `docs/releasing.md` §2; needs a production build first |
| Availability: United States only | Not done | Store settings; noted in `docs/store/listing.md` |
| getreturnsafe.com registered; USPTO search | Not done | Your step. The app now links to getreturnsafe.com |
| Subscription products and group / base plans | Not done | `docs/subscriptions-setup.md` |
| RevenueCat entitlement, offering, webhook | Done (code) / Not done (prod setup) | Webhook built and tested in Phase 6; production webhook URL and secret still to set |
| Paywall disclosures (price, period, trial, auto-renew, cancel, Restore, Terms, Privacy) | Done | Phase 6 paywall; TC-606 manual |
| Sandbox and license-tester purchase tests | Not done | TC-601/602/603/606/608 (Phase 6 manual checks) |
| Privacy Policy, Terms, Support pages live | Not done | Drafts in `docs/legal/`: lawyer review, then publish |
| App Store privacy labels and Play Data safety | Not done | Answers in `docs/store/privacy-answers.md`, ready to enter |
| iOS privacy manifest includes every SDK's required reasons | Done | `npm run check:privacy` passes on the Release build (SDWebImage fixed) |
| Account deletion in the app and on the web | Done (app) / Not done (web) | In-app since Phase 2; web page text in `docs/legal/delete-account.md`. Before using it as the Play "Delete account URL", decide how guests request deletion outside the app (the page lists the options) |
| Not for children; 4+ / Everyone; Terms 13+ | Done (Terms) / Not done (ratings) | Terms draft says 13+; set ratings in each store |
| US state privacy laws (CCPA and others) | Done (draft) | Privacy Policy §5: no sale or sharing; how to request deletion |
| Export compliance (`ITSAppUsesNonExemptEncryption = false`) | Done | `app.config.ts` |
| No ATT prompt (no tracking) | Done | No ATT; Analytics built without IDFA; `NSPrivacyTracking: false` |
| Camera and photo usage text | Done | `app.config.ts` |
| Notification permission only after the primer | Done | Phase 5 |
| Fallback for every permission denial | Done | Phases 4–5 |
| Crashlytics and Analytics; no personal data | Done | `src/lib/telemetry.ts`; tests G7-5 |
| App Check enforced on Firestore, Storage, Functions | Done (Functions, prod param) / Not done (Firestore, Storage) | Console switch in returnsafe-prod; TC-705 |
| Accessibility: labels, VoiceOver/TalkBack, 1.4×, AA contrast | Done (automated) / Not done (TC-701) | Tests G7-2, G7-3; screen-reader pass is manual |
| Dark mode on every screen | Done | Navigation theme fix; test G7-1 |
| Offline add and edit, synced later | Done | Phase 3, plus offline banner now; TC-312 still needs a real device |
| Small and large phones (SE, Pro Max, 360 dp, tablet portrait) | Not done | TC-703 |
| Reminders across time zones and DST | Done | Phase 5 function tests (3 time zones, DST) |
| Cold start under 2.5 s on a mid-range Android phone | Not done | TC-704 |
| Firestore daily backups and budget alerts | Not done | `docs/releasing.md` §1.2 step 6 (prod project) |
| EAS Update with runtimeVersion = app version | Done (config) / Not done (TC-706) | `runtimeVersion: appVersion`; needs `eas init` |
| CI: lint, type check, unit and rules tests on every PR | Done | `.github/workflows/ci.yml` (now with the src/lib coverage bar) |
| App Review notes with demo login and paywall path | Done (draft) | `docs/store/review-notes.md`; create the demo account in prod |
| Screenshots (6.9" iPhone, Android) and feature graphic | Not done | Captions and spec in `docs/store/listing.md`; capture from the production build |
| iPad not supported in 1.0 (`supportsTablet: false`) | Done | `app.config.ts` |
| Keywords | Done (draft) | `docs/store/listing.md` |
| Production builds, TestFlight | Not done | Needs `eas login` / `eas init` and Apple credentials (see Manual checks) |

## Deviations

- **Firestore and Storage App Check enforcement is a console switch**, not code. Callable functions are enforced in code, through a param that is on only in production, so E2E (emulators) and dev builds keep working.
- **expo-image-manipulator is built from source on iOS** instead of using Expo's prebuilt XCFramework, because the prebuilt SDWebImage has no privacy manifest. This adds about a minute to clean iOS builds.
- **Analytics is built without ad-ID support on iOS** (`withoutAdIdSupport`). The app does no tracking, so the IDFA-capable SDKs aren't needed.
- **"Privacy and terms" opens the Privacy Policy page**, which links to the Terms at the top. There's no separate in-app legal screen.
- **The settings version** uses `expo-application` (a new native dependency) to show the store build number, as in the design.
- **Production builds, TestFlight and the 14-day closed test** couldn't run here; see Manual checks.

## Fixed during testing

- **Dark mode:** React Navigation's default light theme showed behind screens (found by the dark-mode audit test); the stack now uses a palette-based navigation theme.
- **Contrast:** the red pill (3.95:1), green pill (3.0:1) and input placeholders (2.56:1) failed AA in light mode. Three new tokens fix them.
- **Privacy manifest:** SDWebImage shipped without a manifest (see above).
- **Android emulator froze** ("System UI isn't responding") during the first Android run, so every flow failed at the first screen; the app itself was running normally behind the dialog. A cold boot fixed it; no app code changed. Both Android runs reported above came after the cold boot.

## Notes

- **Coverage of functions/src is measured end to end.** The emulator kills its workers without a clean exit, so `functions/scripts/coverage-flush.cjs` writes V8 coverage every 500 ms. The unit tests run against the compiled `lib/` (`FUNCTIONS_TEST_COMPILED=1`) so their coverage maps the same way.
- **Legal and store text** uses `[bracketed]` placeholders for the legal entity, contact emails and retention periods.
