# Phase 3 — Receipts core: gate report

**Result:** PASSED (automated). TC-312 is a manual check on a real device, listed below. **Date:** 2026-11-13 · **Branch:** `phase-3/receipts`

## What was built

- **Store policies:**
  - `seed/stores.json` holds 50 US retailers. Each has a return window, notes, the official policy URL and `verifiedAt`.
  - Each store was checked against the retailer's own page in November 2026. Stores whose official pages disagree are flagged `needsReview` (listed below).
  - `npm run seed:stores -- --emulator` (or `--project <id>`, admin only) loads them into the read-only `stores/` collection.
  - The app bundles the same file, so the store picker works offline.
- **Dates (`src/lib/dates.ts`):**
  - Deadlines are calendar dates (`YYYY-MM-DD`): purchase date plus N calendar days, with no clock time. Leap years and DST can't shift them.
  - "Days left" counts from today in the user's saved time zone.
  - `reminderInstants` turns "9 AM, 7/3/1 days before" into exact instants with date-fns-tz. A reminder in the skipped hour on the spring-forward day moves to the next real hour.
- **Money (`src/lib/money.ts`):** amounts are integer cents ($0.01 to $99,999.99), parsed from "$1,234.5"-style input and formatted as USD.
- **Receipt form (new and edit):**
  - **Store picker sheet:**
    - Search over names and aliases.
    - Your own stores are listed first, then popular stores.
    - "Add "…" as a new store" asks for the window (14 / 30 / 60 / 90 or any number up to 365). That window is remembered in `users/{uid}/customStores`.
  - **Purchase date:** iOS uses the inline calendar in a sheet; Android uses the Material date dialog. Future dates can't be picked.
  - **Total and items.**
  - **Return-by card** with "Change".
  - A locked "Add warranty · PRO" row, which opens the paywall stub.
- **Home (S08):**
  - Greeting.
  - Money protected (active receipts) and money saved (returned).
  - Due soon (7 days or fewer) and Later lists, sorted by days left.
  - Empty state with Scan and Enter manually.
  - Loading skeleton, and an error card with Retry.
  - The reminders-off banner is left as a placeholder until Phase 5 wires up notification permission.
- **Receipts (S13):**
  - Search by store or item, and filter chips with counts (All, Due soon, Active, Returned, Kept, Expired).
  - Grouped list (This week, Later, Expired, Returned, Kept) in a FlashList.
- **Detail (S12):**
  - Countdown ring: red 0–2 days, amber 3–7, teal after that.
  - Return-by and bought dates, the items and total, and a photo placeholder.
  - Next reminder time.
  - **Keep it** and **I returned it**, each with a 5-second Undo snackbar.
  - Edit, and Delete with a confirmation, from the ⋯ menu.
- **Undo design:** Returned or Kept is shown straight away but written only when the 5-second window ends. Undo therefore never writes, so money saved and the free-limit counter never change by mistake. Signing out saves any change still waiting.
- **Offline:**
  - Writes are not awaited: the local cache updates at once and syncs later.
  - Receipts with unsynced changes show a grey **Waiting to sync** pill (`hasPendingWrites`).
  - New receipts get their id on the device, so a retry can't create a duplicate.
- **Free limit:**
  - `onReceiptWrite` recounts the user's active receipts in a transaction and stores `activeCount`.
  - The rules deny creating an active receipt, or moving one back to active, when `!isPro && activeCount >= freeLimit`.
  - The app checks the same limit first and shows the limit sheet ("You've used all 5 free receipts", 5 of 5 active, See Pro plans → paywall stub, Not now).
- **Guest merge:**
  - `mergeGuestAccount` now moves the guest's receipts (same ids, with their photos) and custom stores into the signed-in account. When both have a window for the same store, the account's own window wins.
  - The function then deletes the guest's data and the guest user.
  - The "login already has an account" sheet says so again.
- **Rules and indexes:**
  - Receipts are owner-only.
  - Every write is checked against an allowlist of fields with types and ranges: amount 1–9,999,999 cents, store name 1–80 characters, up to 50 items and 5 photos, window 0–365 days, real dates.
  - `createdAt` can't change. The app can't set "expired".
  - `customStores` are owner-only with checked fields. `stores/` is read-only for signed-in users.
  - Composite index on `(status, returnDeadline)` for the Phase 5 reminder queries.

## Results

| Test ID | Type | iOS | Android | Notes |
| ------- | ---- | --- | ------- | ----- |
| TC-301 | Unit | Pass | Pass | 2026-01-31 + 90 days = 2026-05-01 |
| TC-302 | Unit | Pass | Pass | 2028-02-01 + 30 days = 2028-03-02 (leap year) |
| TC-303 | Unit | Pass | Pass | 9 AM America/New_York on 2026-03-08 (DST starts) = 13:00 UTC. Plus 32 more date cases: month ends, Feb 29, year end, DST in 6 US zones, skipped and repeated hours, late-night "today" |
| TC-304 | Rules (emulator) | Pass | Pass | User A can't read, update or delete user B's receipt |
| TC-305 | Rules (emulator) | Pass | Pass | The app can't write isPro, proExpiresAt, activeCount or freeLimit |
| TC-306 | Rules + E2E (Maestro) | Pass | Pass | Rules: a free user's 6th active receipt (activeCount 5) is denied, the 5th is allowed, Pro is unlimited, moving back to active is limited too. App: with 5 active receipts, Enter manually shows the limit sheet and See Pro plans opens the paywall ([iOS](ios-tc306-limit.png), [Android](android-tc306-limit.png)) |
| TC-307 | E2E (Maestro) | Pass | Pass | Target, today, $48.20 → on Home under Later with "90 days" ([iOS](ios-tc307-home.png), [Android](android-tc307-home.png)) |
| TC-308 | E2E (Maestro) | Pass | Pass | Edit date to 80 days ago in the real date picker → detail shows "10 days left", Home shows "10 days" ([iOS](ios-tc308-detail.png), [Android](android-tc308-detail.png)) |
| TC-309 | E2E (Maestro) | Pass | Pass | I returned it, then Undo → back to active; money saved stays $0.00 after the window, and the emulator still has `status: active` ([iOS](ios-tc309-undone.png)) |
| TC-310 | E2E (Maestro) | Pass | Pass | I returned it, then wait → under RETURNED, money saved $48.20, emulator has `status: returned` ([iOS](ios-tc310-returned.png), [Android](android-tc310-returned.png)) |
| TC-311 | E2E (Maestro) | Pass | Pass | Two Target and one Walmart receipt; search "tar" → only the Target ones ([iOS](ios-tc311-search.png)) |
| TC-313 | Unit | Pass | Pass | A future date and an amount of 0 → "The purchase date can't be in the future" and "Enter an amount from $0.01 to $99,999.99"; nothing is saved |
| TC-314 | E2E (Maestro) | Pass | Pass | "Joe's Bikes" with a 30-day window, then a second receipt: picker shows "Your store · 30 days", no window sheet, "30-day return window" ([iOS](ios-tc314-prefilled.png), [Android](android-tc314-prefilled.png)) |
| G3-1 | Functions (emulators) | Pass | Pass | `activeCount` stays correct through create, mark returned, back to active and delete |
| G3-2 | Functions (emulators) | Pass | Pass | `mergeGuestAccount` moves receipts and custom stores (account's windows win), deletes the guest; rejects non-guest tokens, linked guests, a missing token and unauthenticated calls |
| G3-3 | Rules (emulator) | Pass | Pass | Allow and deny per rule: owner CRUD; unknown fields; amount, store name, items, photos, dates, status and createdAt checks; "expired" can't be set by the app; customStores fields; stores read-only |
| G3-4 | Unit | Pass | Pass | Screens against an in-memory Firestore: Home lists and totals, Waiting to sync, add (TC-307), edit (TC-308), custom store (TC-314), limit (TC-306), Undo (TC-309), returned (TC-310), Keep it, Delete with confirm, search (TC-311), filter chips; Undo timing with fake timers |
| G3-5 | Static | Pass | Pass | ESLint, TypeScript strict (app and functions), Prettier, colour check, expo-doctor 20/20 |
| TC-312 | Manual | — | — | Needs airplane mode on a real device (see below) |

**Totals:**
- **Unit:** 11 suites, 175 tests, 7 snapshots.
- **Rules and functions:** 2 files, 35 tests, run against the Auth, Firestore, Storage and Functions emulators.
- **Maestro:** 16/16 flows on the iPhone 17 Pro Max simulator and 16/16 on the Medium Phone API 36.1 emulator. These are Phases 1–3 together, so earlier phases are also covered against regressions. Release builds were built with `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`.

## Stores that need review

These six stores use the window shown, but their official pages disagree or can't be confirmed:

| Store | Window used | Why |
| ----- | ----------- | --- |
| Nordstrom | 365 days | No fixed return window, so the 365 days is a ReturnSafe default |
| Old Navy | 30 days | Only an Old Navy store page states 30 days; the policy FAQ found is Gap Inc.'s shared page |
| Dick's Sporting Goods | 90 days | 90 days on the main policy page, 60 days on the mobile page |
| REI | 90 days | The 1-year member window is on rei.com; the 90-day non-member window appears only in an REI blog post |
| Walgreens | 30 days | The official help page that states 30 days is several years old |
| GameStop | 15 days | The policy page says 15 days, but product pages say 30 days |

Corrections made while checking: Kohl's 90, JCPenney 60, Academy 60, BJ's 365, Crate & Barrel 30, Staples 14, Office Depot 14, and IKEA 180 for opened items.

## Manual check for you

**TC-312: offline add, then sync (real device).**

1. On a dev build connected to Firebase, turn on airplane mode.
2. Add a receipt (for example Target, $20).
3. Pass if it appears on Home and Receipts at once with a grey **Waiting to sync** pill.
4. Turn airplane mode off and wait a few seconds.
5. Pass if the pill changes to the days left and only **one** copy of the receipt exists, in the app and in the Firebase console.

The unit tests cover the pill appearing and clearing as the write's sync state changes.

## Fixed during testing

- **Android keyboard covered the bottom sheets:**
  - The modal window doesn't resize for the keyboard (edge-to-edge), so the store search results were hidden.
  - Sheets now pad themselves above the keyboard on both platforms.
- **Limit sheet on a slow start:** if the profile loaded after the New receipt screen opened, the limit sheet didn't show. It now opens as soon as the limit is known.
- **PRO badge alignment:** the "Add warranty" PRO badge sat at the top of its row; it is now centred.
- **Maestro on iOS:** list rows are one accessibility element ("Walmart, $10.00"), so the flows match text inside them. The iOS number pad sometimes repeats a key under automation, so the flow types the amount again when that happens.

## Notes

- **Expired status:** "Expired" is worked out in the app from the deadline. The server job that marks receipts expired, and the reminders, arrive in Phase 5.
- **Placeholders:** the scanner (Phase 4) has an "Enter manually" button. The paywall is a stub until the Pro phase.
- **Ports:** the Firestore emulator still uses port **8180**.
