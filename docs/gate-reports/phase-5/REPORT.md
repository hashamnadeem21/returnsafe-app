# Phase 5 — Reminders: gate report

**Result:** PASSED (automated). TC-501, TC-502 and TC-505 need real push notifications, so they are manual checks on real devices, listed below. Simulator versions of TC-501 and TC-502 also run as E2E flows. **Date:** 2026-11-18 · **Branch:** `phase-5/reminders`

## What was built

- **Push setup (`@react-native-firebase/messaging` 27):**
  - Permission is asked only from the notification primer (S07), the Home banner or Reminder settings, never at launch.
    - iOS: the system prompt (alert, sound, badge). `aps-environment` and the `remote-notification` background mode are set in `app.config.ts`.
    - Android 13+: the `POST_NOTIFICATIONS` runtime permission. Once it has been refused for good, the app opens the phone's settings for the app instead.
  - Android channel **"return-reminders"** (high importance) is created when the app starts. Reminders use the app's notification icon and the brand teal.
  - This device's FCM token is saved in `users/{uid}.fcmTokens`, saved again when FCM issues a new one, and removed on sign-out.
- **Functions:**
  - **onReceiptWrite** rebuilds the receipt's rows in `reminders/{id}`:
    - Free: 1 day before. Pro: the user's `reminderDays` (default 7, 3, 1).
    - At `reminderHour` in the user's time zone. Times already past are skipped. An hour that doesn't exist on the day clocks spring forward moves to the next hour; an hour that happens twice fires once.
    - Unsent rows are deleted when the receipt is no longer active or is deleted. Rows already sent are kept, so a reminder is never sent twice.
    - Warranty reminders 30 days before `warrantyEnd`, for Pro only, kept after the return window closes.
    - Edits that don't change the status, deadline or warranty end skip the rebuild.
  - **sendDueReminders** (every 15 minutes) sends due rows through FCM with `data: { receiptId }` and marks them sent.
    - Tokens FCM reports as no longer valid are removed from the user.
    - Rows whose receipt is gone, no longer active or past its date are dropped without sending.
  - **expireReceipts** (daily, 03:15 Los Angeles time) marks active receipts expired once their return-by date is past in the user's time zone. The deadline day itself still counts as open.
  - **onUserWrite** rebuilds all of a user's rows when `isPro`, the reminder switch, `reminderDays`, `reminderHour` or `timezone` changes.
  - **deleteAccount** also deletes the user's reminder rows.
- **Notification text:**
  - Title "Target return closes in 2 days" ("in 1 day", "today"). Warranty: "Apple warranty ends in 30 days".
  - Body "$48.20 · Kids sneakers, bath towels": at most three items, cut to 120 characters.
- **Opening a reminder:**
  - From a closed app or the background, a tap opens `receipt/[id]` once the receipts have loaded. If the receipt no longer exists, Home opens.
  - While the app is open, the reminder shows as an in-app message with **View**, on both platforms (the phone shows nothing while the app is open).
- **Notification primer (S07):** "Never miss a deadline", with a sample reminder. **Turn on reminders** asks for permission; **Not now** goes on without asking.
- **Reminder settings (S17):**
  - Return reminders on or off.
  - Time of day (a list of hours).
  - Days before: 7, 3 and 1. For Free, 7 and 3 show a lock and open the paywall, with "Pro adds reminders 7 and 3 days before." Pro can choose any, keeping at least one.
  - Warranty reminders: Pro, 30 days before coverage ends.
  - Phone settings: "Notifications allowed" or "Notifications are off", which asks again or opens the phone's settings.
- **Home banner:** "Reminders are off. Turn them on so you don't miss a deadline. **Turn on**", shown when notifications aren't allowed or return reminders are switched off. Turn on fixes whichever it is.
- **Rules:** users can write only their own `fcmTokens` (a list of at most 10) and `remindersEnabled` (true or false). `reminders/*` is server only.

## Results

| Test ID | Type | iOS | Android | Notes |
| ------- | ---- | --- | ------- | ----- |
| TC-503 | Functions (emulator) | Pass | Pass | A Pro receipt due in 30 days for a Chicago user (reminder hour 9) gets 3 unsent rows: 7, 3 and 1 day before, each at 9:00 Chicago time |
| TC-504 | Functions (emulator) | Pass | Pass | The same receipt for a Free user gets 1 row, the day before |
| TC-506 | Functions (emulator) | Pass | Pass | Marking the receipt Returned deletes its unsent rows |
| TC-507 | Functions (emulator) | Pass | Pass | An active receipt past its deadline becomes expired; one due today stays active; returned receipts are not touched |
| TC-508 | Unit | Pass | Pass | 9 AM Los Angeles on 2026-12-01 is 17:00 UTC |
| G5-1 | Unit | Pass | Pass | DST: New York, Chicago and Los Angeles at the start (2026-03-08) and end (2026-11-01) of daylight saving, the day before and on the day. Also: 2 AM on the spring-forward day moves to 3 AM; 1 AM on the fall-back day fires once; days left are counted in the user's time zone |
| G5-2 | Unit | Pass | Pass | Payload: title and body as the spec shows; "1 day" and "today"; at most three items, empty ones left out; amount only with no items; a long body is cut; warranty wording; thousands separators; the FCM message carries `data.receiptId`, the Android channel and sound on iOS |
| G5-3 | Functions (emulator) | Pass | Pass | Also: past times skipped and rows moved when the deadline changes; a sent row is kept; Pro warranty row; rows deleted with the receipt; settings changes rebuild rows; sendDueReminders sends once with the receipt id and removes dead tokens; nothing is sent for a deleted receipt |
| G5-4 | Rules (emulator) | Pass | Pass | A user can save their own tokens and the reminder switch; more than 10 tokens or a non-boolean switch is refused; reminder rows can't be read or written by any user |
| G5-5 | Unit | Pass | Pass | App, against fakes for messaging and permissions: primer Allow saves the token (TC-501 path) and Don't allow shows the banner (TC-502 path); Not now never asks; banner Turn on asks or opens settings and switches reminders back on; S17 switch, hour, Free locks and paywall, Pro day choices, warranty and permission rows; a tap from the background or a closed app (TC-505 path) opens the receipt, a missing receipt opens Home, the in-app message's View opens it; the token is removed on sign-out |
| G5-6 | E2E (Maestro) | Pass | Pass | TC-502 on a simulator: primer → Turn on reminders → Don't allow. Home shows "Reminders are off … Turn on" ([iOS](ios-tc502-home.png), [Android](android-tc502-home.png)); Reminder settings shows "Notifications are off" and the Free locks ([iOS](ios-tc502-settings.png), [Android](android-tc502-settings.png)) |
| G5-7 | E2E (Maestro) | Pass | Pass | TC-501 on a simulator: primer → Turn on reminders → Allow. No banner on Home; Reminder settings shows "Notifications allowed" ([iOS](ios-tc501-settings.png), [Android](android-tc501-settings.png)). On Android the flow also checks that exactly one FCM token was saved on the user in the Firestore emulator. iOS simulators get no push token without an APNs key, so that part is in the manual check |
| G5-8 | Static | Pass | Pass | ESLint, TypeScript strict (app and functions), Prettier, colour check, expo-doctor 20/20 |
| TC-501 | Manual | — | — | Allow on a real phone saves the token (see below) |
| TC-502 | Manual | — | — | Don't allow on a real phone (see below) |
| TC-505 | Manual | — | — | Tap a real reminder from a closed app, the background and the foreground (see below) |

**Totals:**
- **Unit:** 15 suites, 258 tests, 7 snapshots.
- **Rules and functions:** 5 files, 71 tests, run against the Auth, Firestore, Storage and Functions emulators.
- **Maestro:** 19/19 flows on the iPhone 17 Pro Max simulator and 19/19 on the Medium Phone API 36.1 emulator. Earlier phases' flows are included as regression checks. Release builds were built with `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`.

## Manual checks for you

### Before you start

1. **APNs key (iOS).** In the [Apple Developer portal](https://developer.apple.com/account/resources/authkeys/list), create a key with **Apple Push Notifications service (APNs)** and download the `.p8` file. In the Firebase console → Project settings → Cloud Messaging → Apple app configuration, upload it with its Key ID and your Team ID.
2. **Deploy** the functions, rules and indexes to the dev project:
   ```bash
   npx firebase deploy --only functions,firestore:rules,firestore:indexes
   ```
   The new index (`reminders`: `sent`, `sendAt`) takes a few minutes to build; `sendDueReminders` fails until it is ready.
3. Install a build connected to the dev project (not the emulators) on a real iPhone and a real Android phone (Android 13 or later). The iOS build must be signed with the push entitlement (any development or TestFlight build from EAS is).

### How to get a reminder within about 2 minutes

Reminders are sent by `sendDueReminders`, which runs every 15 minutes. To avoid waiting:

1. Add a receipt in the app (any store). In the Firebase console → Firestore, open `reminders` and find a row with this receipt's `receiptId`. Note its document id.
   - If there is none (the reminder times are all past), set the receipt's return-by date to tomorrow in the app; a row appears.
2. Edit that row: set `sendAt` to a time 2 minutes from now (timestamp) and make sure `sent` is `false`.
3. Wait 2 minutes, then in Google Cloud console → Cloud Scheduler, find `firebase-schedule-sendDueReminders-us-central1` and choose **Force run**.
4. The reminder arrives within a few seconds. The row now has `sent: true`. To send it again, set `sent` back to `false`, move `sendAt` again and force another run.

### TC-501: Allow saves the token

1. Delete and reinstall the app, then sign up.
2. On "Never miss a deadline", tap **Turn on reminders**, then **Allow**.
3. **Pass if:**
   - Home shows no "Reminders are off" banner.
   - Settings → Reminders says **Notifications allowed**.
   - In Firestore, `users/<uid>.fcmTokens` holds one token. (The uid is next to the account's email in the Firebase console → Authentication.)
4. Do the same on the other phone, signed in to the same account. **Pass if** `fcmTokens` now holds two tokens.

### TC-502: Don't allow

1. Delete and reinstall the app, then sign up.
2. On the primer, tap **Turn on reminders**, then **Don't Allow** (iOS) or **Don't allow** (Android).
3. **Pass if:**
   - Home shows "Reminders are off. Turn them on so you don't miss a deadline. **Turn on**".
   - Settings → Reminders says **Notifications are off**.
4. Tap **Turn on** on the banner. **Pass if** the phone's settings for ReturnSafe open (on Android 13+, the first refusal may show the system prompt once more). Allow notifications there and return to the app. **Pass if** the banner is gone and a token is saved (as in TC-501).

### TC-505: tapping a reminder

Send a reminder as above for each case.

1. **Closed app:** swipe the app away, send the reminder and tap it. **Pass if** the app opens on that receipt's detail.
2. **Background:** open the app, go to the home screen of the phone, send the reminder and tap it. **Pass if** the app comes back on that receipt's detail.
3. **Open app:** keep the app open on Home and send the reminder. **Pass if** an in-app message shows the reminder's title with **View**, and View opens the receipt.
4. **Deleted receipt:** send a reminder but don't tap it. Delete its receipt in the app, then tap the reminder in the notification list. **Pass if** Home opens.
5. **Pass if** the text reads like "Target return closes in 1 day" and "$48.20 · Kids sneakers, bath towels", and on Android it is under the **Return reminders** channel (long-press the notification).

## Deviations

- **Permission requests use a small local Expo module (`modules/reminder-notifications`).** RNFirebase 27 marks its permission functions as deprecated. The module (about 120 lines) uses Apple's `UNUserNotificationCenter` on iOS. On Android it creates the "return-reminders" channel and reads whether notifications are on; the Android 13+ runtime prompt uses React Native's `PermissionsAndroid`. It is an Expo module, so it supports the New Architecture and needs no manual native edits.
- **New user field `remindersEnabled`** (default `true`) stores the S17 "Return reminders" switch, which the data model didn't have. Switching it off stops return reminders only; Pro warranty reminders continue (they have their own row in S17).
- **In-app message while the app is open.** The spec asks for tap handling in the foreground. Phones don't show a notification while the app is open, so the app shows the reminder as an in-app message with **View** instead, which opens the receipt.

## Notes

- **expireReceipts** reads only receipts whose return-by date is before today in the earliest time zone, then checks each against its user's own time zone, so a receipt is never expired early.
- **sendDueReminders and expireReceipts don't run in the local emulators** (they need the Pub/Sub emulator). Their logic is tested by calling it directly in the functions tests.
- **Maestro and permissions:** Maestro allows all permissions when it launches the app, so the two new flows reset the notification permission first. Earlier flows run with notifications allowed, so they don't see the banner.

## Fixed during testing

- **Android test build couldn't reach the emulators.** The Android project had been regenerated without `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`, so the release build blocked plain HTTP to the local emulators and every sign-up failed with "Something went wrong". Regenerating it with the variable set fixed it; no app code changed. The README's end-to-end steps now say so.
