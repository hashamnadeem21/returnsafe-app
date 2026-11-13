# Phase 2 — Login and signup: gate report

**Result:** PASSED (automated). TC-206, TC-207 and TC-212 are manual checks on a real device, listed below. **Date:** 2026-11-13 · **Branch:** `phase-2/auth`

## What was built

- **Sign-in methods:**
  - Email and password.
  - Apple (iOS only; the button is hidden on Android), Google (both platforms) and guest (anonymous), all through React Native Firebase 27.
  - App Check uses the debug provider in dev builds, and App Attest / Play Integrity in release.
- **Screens:**
  - Welcome (S03): Apple first on iOS, Google first on Android.
  - Sign up (S04) and Log in (S05).
  - Forgot password (S06): neutral message and a 30-second resend timer.
  - Notification primer (S07): UI only; the permission prompt comes in Phase 5.
  - Settings tab with a profile card, and Account (S18).
  - Save account (guest to email) and Delete account (S19).
- **Validation and errors:**
  - zod rules: a valid email, and a password of at least 8 characters with a number. The submit button stays disabled until the form is valid.
  - Every Firebase auth error has friendly text. A wrong password and an unknown email give the same message.
  - Password reset always shows the neutral message.
  - "Account exists with different credential" names the provider to use.
  - A cancelled Apple or Google sheet returns quietly.
- **Guest to real account:**
  - `linkWithCredential` keeps the same uid.
  - If the login already belongs to another account, the app offers "Sign in to that account" and calls `mergeGuestAccount`. That function is a stub for now: it checks the guest token, and Phase 3 moves the receipts.
- **Server (Cloud Functions in `functions/`):**
  - `initUser` creates `users/{uid}` with the defaults: reminder hour 9, days [7,3,1], device timezone, activeCount 0, isPro false, freeLimit 5. Only the server writes this document.
  - `deleteAccount` requires a sign-in within the last 5 minutes (guests are exempt). It then deletes the user document and its subcollections, the Storage files under `users/{uid}/`, and the auth user.
- **Firestore rules for `users/{uid}`:**
  - Only the owner can read the document.
  - The app may update only displayName, reminderHour, reminderDays, timezone and updatedAt, with value checks.
  - The app can't create or delete the document, and can't touch isPro, proExpiresAt, activeCount or freeLimit.
  - Everything else stays denied.
- **Auth gate:**
  - `Stack.Protected` in the root layout: signed-out users see `(auth)`; signed-in users see the tabs and the other screens.
  - Signing out clears local caches (except the onboarding and install flags), so Back can't return to Home.
  - On the first launch after an install, the app signs out a login left in the iOS Keychain by an earlier install.

## Results

| Test ID | Type | iOS | Android | Notes |
| ------- | ---- | --- | ------- | ----- |
| TC-201 | E2E (Maestro) | Pass | Pass | New email + Test1234: primer, then Home. The flow then checks in the Firestore emulator that `users/{uid}` exists ([iOS](ios-tc201-account.png)) |
| TC-202 | Unit | Pass | Pass | Password "abc" shows "Use at least 8 characters with a number" and Create account stays disabled |
| TC-203 | E2E (Maestro) | Pass | Pass | "An account with this email already exists", and "Log in instead" opens Log in ([iOS](ios-tc203-email-exists.png)) |
| TC-204 | E2E (Maestro) | Pass | Pass | "Email or password is incorrect" for a wrong password and for an unknown email; the email stays filled in ([iOS](ios-tc204-wrong-password.png)) |
| TC-205 | E2E (Maestro) | Pass | Pass | Identical neutral message for an unknown and a known email; resend counts down ([iOS](ios-tc205-unknown-email.png)) |
| TC-208 | E2E (Maestro) | Pass | Pass | Android: no Apple button and Google first ([Android](android-tc208-welcome.png)). iOS: Apple first ([iOS](ios-tc208-welcome.png)) |
| TC-209 | E2E (Maestro) | Pass | Pass | Guest saves with email; uid unchanged and the user doc exists. "Add a receipt" arrives with receipts in Phase 3 ([iOS](ios-tc209-saved.png)) |
| TC-210 | E2E (Maestro) | Pass | Pass | After sign-out, swipe back (iOS) or Back (Android) and relaunch: Welcome stays and Home can't be reached |
| TC-211 | Functions (emulators) | Pass | Pass | User with 3 receipts and 2 photos: user doc, receipts, photos and auth user all removed; another user's data untouched |
| G2-1 | Rules (emulator) | Pass | Pass | Owner can read and update their settings; others can't read or write; can't set isPro, proExpiresAt, activeCount or freeLimit; can't create or delete; out-of-range values rejected |
| G2-2 | Functions (emulators) | Pass | Pass | initUser defaults, idempotent (never resets isPro), bad timezone falls back; stale login is refused with `requires-recent-login`; guests can delete; mergeGuestAccount rejects non-guest tokens |
| G2-3 | Unit | Pass | Pass | Error mapping, auth screens and gate (TC-201 to 205, 209, 210 against an in-memory Firebase), fresh-install Keychain sign-out, Delete account |
| G2-4 | Static | Pass | Pass | ESLint, TypeScript strict (app and functions), Prettier, colour check |
| TC-206 | Manual | — | n/a | Needs a real iPhone and an Apple Developer account (see below) |
| TC-207 | Manual | — | — | Needs Google's real sign-in sheet (see below) |
| TC-212 | Manual | — | — | Needs airplane mode on a real device (see below) |

**Totals:**
- Unit: 6 suites, 88 tests, 7 snapshots.
- Rules and functions: 2 files, 15 tests, run against the Auth, Firestore, Storage and Functions emulators (`npm run test:functions`).
- Maestro: 9/9 flows on the iPhone 17 Pro Max simulator and 9/9 on the Medium Phone API 36.1 emulator. Release builds were built with `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`. The JUnit results are in this folder.

## Manual checks for you

**TC-206: Sign in with Apple (iPhone).** First join the Apple Developer Program, then:

1. In the Apple Developer portal, enable "Sign in with Apple" on the `com.returnsafe.app` identifier.
2. In the Firebase console, turn on Apple under Authentication → Sign-in method.

To test:

1. Install a dev build on a real iPhone.
2. Tap Sign in with Apple and choose "Hide My Email".
3. Pass if Home opens and Settings → Account shows the private relay email. Your name should show on the Settings profile card. Apple only sends the name the first time.

**TC-207: Google cancel and retry (iPhone and Android).**

1. On a dev build that talks to the real Firebase project, tap Continue with Google.
2. Close the Google sheet without choosing an account. Pass if you land back on Welcome with no error message.
3. Tap Continue with Google again and pick an account. Pass if Home opens.

**TC-212: no internet.**

1. Turn on airplane mode, then open Log in and log in with a valid account.
2. Pass if you see "No internet connection. Check your connection and try again." and the app doesn't crash.
3. Turn airplane mode off and tap Log in again. Pass if Home opens.

## Fixed during testing

- **iOS crash on Welcome:**
  - The Apple button read `AppleButtonStyle.BLACK`. The library's types export that name, but it doesn't exist at runtime; the real names are `AppleButton.Style` and `AppleButton.Type`.
  - The resulting render error crashed the Release build. Android never draws the button, so it passed.
  - Fixed. The root layout now also exports Expo Router's `ErrorBoundary`, so a render error shows a retry screen instead of crashing.
- **Android build:** Firebase Auth 25 is compiled with Kotlin 2.4, so the project now pins Kotlin 2.4.0 through `expo-build-properties`.
- **Android release builds and the emulators:** these builds block plain HTTP, which the emulators use. Plain HTTP is now allowed only when the build has `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`.
- **iOS Keychain:** a login survives deleting the app. The first launch after an install now signs out, so a new install never opens someone's old session.
- **iOS password autofill:** the "Automatic Strong Password" cover blocked typing in automated tests. Emulator/E2E builds turn off password-manager hints. Store builds keep strong-password suggestions and autofill.

## Notes

- **Ports:** the Firestore emulator uses port **8180** instead of 8080, because another local project uses 8080.
- **Google sign-in config:** the Android `google-services.json` and iOS `GoogleService-Info.plist` now contain the OAuth clients. The Web client ID is in `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. These files stay out of git.
- **Not deployed yet:** nothing is deployed to the real Firebase project. Deploying the rules and functions needs:
  - the Blaze plan
  - a Firestore database in a US region
  - `firebase login`

  This happens in a later phase.
- **App Check:** enforcement on the functions stays off until the debug tokens are registered. Turning it on is part of release hardening.
