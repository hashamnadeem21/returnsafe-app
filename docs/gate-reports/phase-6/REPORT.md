# Phase 6 — Subscriptions and Pro: gate report

**Result:** PASSED (automated). TC-601, TC-602, TC-603, TC-606 and TC-608 need real store purchases, so they are manual checks with an Apple sandbox account and a Google Play license tester, listed below. Unit versions of TC-601, TC-602 and TC-606 also run against a fake store. **Date:** 2026-11-18 · **Branch:** `phase-6/subscriptions`

## What was built

- **RevenueCat (`react-native-purchases` 11):**
  - RevenueCat's app user id is the Firebase uid. The SDK is set up after sign-in (`logIn` when it is already set up) and `logOut` runs on sign-out.
  - Entitlement **pro**. Offering **default** with `rs_pro_yearly` (7-day free trial) and `rs_pro_monthly`.
  - The keys come from `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Without a key the app runs as Free and the paywall says plans can't load.
  - Exact App Store Connect, Google Play Console, RevenueCat and webhook steps are in [docs/subscriptions-setup.md](../../subscriptions-setup.md).
- **Where Pro comes from:**
  - The app unlocks from RevenueCat's customer info right away (`useIsPro()` is the server's `isPro` or RevenueCat's entitlement).
  - Rules and functions trust only `users/{uid}.isPro`, which only the webhook writes.
- **revenueCatWebhook (HTTPS function):**
  - Checks `Authorization: Bearer <secret>` against the `REVENUECAT_WEBHOOK_SECRET` secret with a timing-safe compare. A wrong or missing secret gets 401 and changes nothing.
  - INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE: Pro until the new expiry. CANCELLATION: Pro until the paid period ends. BILLING_ISSUE: Pro until the grace period ends. EXPIRATION: Pro ends. TRANSFER: Pro moves to the account that restored the purchase.
  - Every event is recorded in `billingEvents/{eventId}` inside the same transaction, so a repeat delivery changes nothing. `users/{uid}.proEventAt` keeps the time of the last event applied, so an older event that arrives late is ignored.
  - Anonymous RevenueCat ids are skipped; the user is found through the event's aliases.
- **Paywall (S15):** close, Restore, the Pro feature list, Yearly (selected, with its trial and "SAVE N%") and Monthly plan cards, "Start 7-day free trial" or "Subscribe", the store's renewal and cancel text, Terms of Use and Privacy Policy.
  - Cancelling the store sheet stays Free with no message. Pending and failed purchases show a banner.
  - After a purchase or restore the paywall waits up to 8 seconds for the server's `isPro`, shows "Welcome to ReturnSafe Pro" (or "Pro restored") and closes.
- **Pro gating:**
  - The 6th active receipt opens the limit sheet; **See Pro** opens the paywall and the form stays open after upgrading.
  - Warranties tab, warranty months on the receipt form, reminders 7 and 3 days before, more than one photo per receipt, and export.
  - Rules: warranties and more than one photo need `isPro` too. After Pro ends, a saved warranty can be kept or removed but not changed, and photos can be removed but not added.
- **Warranties tab (S14):**
  - Free: a locked card "Track warranties with Pro" over a faded sample list; tapping it opens the paywall.
  - Pro: "N products covered", warranties sorted by end date with time left, a banner when coverage ends within 4 months, Add warranty, empty, loading and error states.
  - Receipt form: **Warranty (months)**, 1 to 120, with "Coverage ends …". The end date is the purchase date plus that many calendar months.
- **Extra photos:** receipt detail shows a strip of photos with **Add photo** (camera or library). Free keeps one; Pro up to 5.
- **Export (S20):** PDF or CSV, all receipts or active only, shared with the phone's share sheet.
  - CSV columns: Store, Purchase date, Total (USD), Items, Return window (days), Return by, Status, Warranty (months), Warranty ends. UTF-8 with a BOM and CRLF line ends; fields with commas, quotes or line breaks are quoted; text starting with `=`, `+`, `-`, `@`, tab or carriage return gets a leading apostrophe so spreadsheets don't run it.
  - PDF: one section per receipt with its details and photos.
- **Settings (S16):** plan pill (Free or Pro), an upgrade banner for Free, Reminders, Export (locked for Free), **Restore purchases** (with the result as a message), **Manage subscription** (the store's subscription page) and Account.

## Results

| Test ID | Type | iOS | Android | Notes |
| ------- | ---- | --- | ------- | ----- |
| TC-604 | Functions (emulator) | Pass | Pass | EXPIRATION sets `isPro` false. With the user's own sign-in, reading receipts still works (200) and creating a 6th active receipt is refused (403) |
| TC-605 | Functions (emulator) | Pass | Pass | Wrong secret, a secret without "Bearer" and no header each get 401; no event is recorded and the user is unchanged |
| TC-609 | Functions (emulator) | Pass | Pass | BILLING_ISSUE with a grace period in the future keeps Pro; a later EXPIRATION ends it; the repeat is a duplicate |
| G6-1 | Functions (emulator) | Pass | Pass | One test per event type, each delivered twice (the second is a duplicate and changes nothing): INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE, CANCELLATION, EXPIRATION, BILLING_ISSUE, TRANSFER. Also: 400 and 405, a late older event is ignored, lookup by alias, other entitlements, unknown users and TEST events are ignored |
| G6-2 | Rules (emulator) | Pass | Pass | A user can't write `isPro`, `proExpiresAt` or `proEventAt`; the 5-active limit holds without the app's check, including after Pro expires; warranties and more than one photo need Pro; a saved warranty can be kept or removed after Pro ends but not changed |
| TC-607 | E2E (Maestro) | Pass | Pass | Free user opens Warranties, sees the locked card, taps it and the paywall opens with Restore, Terms of Use and Privacy Policy; back returns to the locked card ([iOS](ios-tc607-locked.png), [Android](android-tc607-locked.png)) |
| G6-3 | Unit | Pass | Pass | CSV: column order, one row per receipt, BOM and CRLF; commas, quotes and line breaks quoted and quotes doubled; formula text defused; items joined with semicolons, cents as dollars |
| G6-4 | Unit | Pass | Pass | App against a fake store: paywall content (TC-606 path), cancel stays Free (TC-602 path), purchase unlocks Pro and closes once the server agrees (TC-601 path), pending, failed, restore, no key; Warranties locked and Pro list; Settings for Free and Pro, CSV export, restore and manage; warranty save; Free extra photo and 6th receipt open the paywall |
| G6-5 | Static | Pass | Pass | ESLint, TypeScript strict (app and functions), Prettier, colour check, expo-doctor 20/20 |
| TC-601 | Manual | — | — | Buy Yearly in the sandbox (see below) |
| TC-602 | Manual | — | — | Cancel the store sheet (see below) |
| TC-603 | Manual | — | — | Reinstall and sign in: Pro comes back without Restore (see below) |
| TC-606 | Manual | — | — | Paywall shows the store's real prices and text (see below) |
| TC-608 | Manual | — | — | Export 20 receipts as PDF (see below) |

**Totals:**
- **Unit:** 16 suites, 284 tests, 7 snapshots.
- **Rules and functions:** 6 files, 90 tests, run against the Auth, Firestore, Storage and Functions emulators.
- **Maestro:** 20/20 flows on the iPhone 17 Pro Max simulator and 20/20 on the Medium Phone API 36.1 emulator. Earlier phases' flows are included as regression checks. Release builds were built with `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1` and no RevenueCat key, so the paywall shows "Plans can't load right now" ([iOS](ios-paywall-no-key.png), [Android](android-paywall-no-key.png)). Settings for a Free user: [iOS](ios-settings-free.png), [Android](android-settings-free.png).

## Manual checks for you

### Before you start

1. Follow [docs/subscriptions-setup.md](../../subscriptions-setup.md) sections 1 to 3: create the subscription group and both products in App Store Connect and Google Play, then the entitlement, products and offering in RevenueCat.
2. Set the webhook secret and deploy the functions and rules to the dev project:
   ```bash
   npx firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET
   ```
   ```bash
   npx firebase deploy --only functions,firestore:rules
   ```
   In RevenueCat → Integrations → Webhooks, set the URL to the `revenueCatWebhook` function's URL and the Authorization header to `Bearer <the same secret>`.
3. Put the RevenueCat public keys in `.env` (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`) and install a build connected to the dev project on a real iPhone and a real Android phone. On Android it must be installed from the internal testing track, or signed with the same key.
4. Create an **Apple sandbox account** and a **Google Play license tester** as in [section 4 of the setup guide](../../subscriptions-setup.md#4-test-accounts). In short:
   - **Apple:** App Store Connect → Users and Access → Sandbox → Test Accounts → **+**, with an email that has never been an Apple ID. On the iPhone, sign in under Settings → Developer → Sandbox Apple Account.
   - **Google:** Play Console → Settings → License testing, add the phone's Gmail with RESPOND_NORMALLY, and add it as a tester on the internal testing track.

### TC-606: paywall content

1. Sign in with a Free account and open Settings → **Upgrade to Pro**.
2. **Pass if** you see the Pro features, Yearly selected with its price per year, "7-day free trial, then $…/year" and "SAVE N%", Monthly with its price per month, **Start 7-day free trial**, the renewal text ("Renews automatically unless cancelled at least 24 hours before…"), **Restore**, **Terms of Use** and **Privacy Policy**. Both links open.

### TC-602: cancel the purchase sheet

1. On the paywall, tap **Start 7-day free trial**, then close the store sheet (Cancel on iOS, back on Android).
2. **Pass if** the paywall is still open with no error and Settings still shows **Free**.

### TC-601: buy Yearly

1. On the paywall, tap **Start 7-day free trial** and confirm with the sandbox account or test card.
2. **Pass if:**
   - "Welcome to ReturnSafe Pro" shows and the paywall closes; Settings shows **Pro**.
   - In Firestore, `users/<uid>.isPro` is `true` and `proExpiresAt` is about 7 days away (3 minutes in Apple's sandbox time).
   - Warranties opens the list instead of the locked card, and you can add a 6th active receipt.
   - RevenueCat → Customers shows the uid with an active **pro** entitlement in trial.

### TC-603: Pro comes back after reinstalling

1. Delete the app, reinstall it and sign in with the same account.
2. Open Settings without tapping Restore.
3. **Pass if** Settings shows **Pro** and Warranties is unlocked.
4. Also try it on the other phone with the same account.

### TC-608: export 20 receipts as PDF

1. As a Pro user, have at least 20 receipts (some with photos).
2. Settings → **Export** → **PDF**, **All**, then **Export**.
3. **Pass if** the share sheet opens with a PDF; saving or opening it shows all 20 receipts, readable, with their photos.
4. Do the same with **CSV** and open it in Numbers, Excel or Google Sheets. **Pass if** the columns line up and amounts are numbers.

### Optional: billing events

- Turn auto-renew off in the store (**Manage subscription** in Settings). **Pass if** Pro stays until the trial ends, then `isPro` turns `false` and Warranties shows the locked card again.
- With the slow test card on Android, a purchase shows "Your purchase is waiting for approval" and Pro arrives when it approves.

## Deviations

- **TRANSFER and `proEventAt`.** The spec lists the purchase events; the webhook also handles TRANSFER (Restore on a different account moves Pro there) and keeps `proEventAt` so late, older events can't undo newer ones. `proEventAt` is a new server-only user field.
- **Pro features are also enforced in the rules**, not only the 5-receipt limit: warranties and more than one photo need `isPro`. After Pro ends, a user keeps what they saved but can't add more.
- **The paywall waits up to 8 seconds for the server** after a purchase, so the 6th receipt isn't refused by the rules right after buying. If the webhook is slower, the app is already unlocked and the server catches up.
- **Add warranty on the Warranties tab opens a new receipt**, since a warranty belongs to a receipt.
- **Export "Include" uses two chips** (All, Active only) instead of a dropdown, which needs fewer taps for two choices.
- **The Free Warranties preview is faded, not blurred.** A blur needs a native library; fading gives the same look without one.
- **Help and Privacy rows in Settings** are left for Phase 7, which covers them.

## Notes

- **The webhook secret** is a Firebase secret, never in the repo. For the emulators, `scripts/ensure-local-secrets.mjs` writes a test value to `functions/.secret.local` (git-ignored) before `npm run emulators` and `npm run test:functions`.
- **E2E builds have no RevenueCat key**, so the Maestro flow checks the paywall's layout and links, not prices. Real prices are checked in TC-606.

## Fixed during testing

- **TC-607 on iOS:** the locked card is one button, so iOS reads its text as the button's label and Maestro couldn't find the text on its own. The flow now finds the card by id and checks its text. The full iOS suite was run again after the fix.
- **Android emulator froze** ("System UI isn't responding") during the first run, so every flow failed at the first screen. A cold boot fixed it; no app code changed.
