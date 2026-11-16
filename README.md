# ReturnSafe

iOS and Android app that scans receipts and reminds you before store return windows and warranties expire.

- **Stack:** React Native (Expo, TypeScript), Firebase, RevenueCat
- **Market:** United States (English, USD)
- **Plans:** Free (5 active receipts) and Pro ($2.99/month or $19.99/year with a 7-day trial)

## Project docs

| File                                                                   | Contents                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [docs/design/ReturnSafe-Design.pdf](docs/design/ReturnSafe-Design.pdf) | Brand, components, navigation map and every screen for iOS and Android |
| [docs/brand](docs/brand)                                               | Logo and app icon source files                                         |
| [docs/BUILD_PROMPT.md](docs/BUILD_PROMPT.md)                           | Build plan in 9 phases, each with a test gate                          |

## Local setup

Requirements: Node 22, Xcode 26.4 or newer (Expo SDK 58 minimum), Android Studio with an API 36 emulator, JDK 17 (JDK 21+ for the Firebase emulators), CocoaPods.

1. `npm install`, then `npm ci --prefix functions` for the Cloud Functions package (the emulators build it)
2. Put the Firebase config files in `firebase/dev/` (see [firebase/README.md](firebase/README.md)).
3. CocoaPods needs a UTF-8 shell: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`
4. `npm run prebuild`, then `npm run ios` or `npm run android`
5. `npm run check` runs lint, type check, formatting and tests.

## End-to-end tests

Flows live in `e2e/` and run with [Maestro](https://maestro.mobile.dev) against a Release build (JS bundled, no Metro) that talks to the local Firebase emulators. The emulators need Java 21 or newer.

```bash
npm run emulators
```

Then, in a second terminal:

```bash
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1 npx expo run:ios --configuration Release
npm run e2e:ios
```

```bash
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1 npx expo run:android --variant release
npm run e2e:android
```

The scan flow (TC-402) picks a receipt photo from the device's library, since simulators have no camera. Add the test receipt once per device before running it:

```bash
xcrun simctl addmedia booted e2e/assets/walmart-receipt.png
```

```bash
adb push e2e/assets/walmart-receipt.png /sdcard/Pictures/walmart-receipt.png && adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/walmart-receipt.png
```

`e2e/scripts/make-receipt-image.py` re-creates the image if needed.

Firestore and Storage rules and Cloud Functions tests start their own emulators: `npm run test:functions`.

The 51 built-in store return policies live in `seed/stores.json`. Load them into a running emulator with `npm run seed:stores -- --emulator`, or into a real project with `npm run seed:stores -- --project <id>` (needs admin credentials).

Unit tests, lint, the hex-colour check, type check and formatting all run with `npm run check`.

## Build status

| Phase | Scope                        | Gate                                                   |
| ----- | ---------------------------- | ------------------------------------------------------ |
| 0     | Foundation                   | Passed ([report](docs/gate-reports/phase-0/REPORT.md)) |
| 1     | Design system and navigation | Passed ([report](docs/gate-reports/phase-1/REPORT.md)) |
| 2     | Login and signup             | Passed ([report](docs/gate-reports/phase-2/REPORT.md)) |
| 3     | Receipts core                | Passed ([report](docs/gate-reports/phase-3/REPORT.md)) |
| 4     | Scanning and photos          | Passed ([report](docs/gate-reports/phase-4/REPORT.md)) |
| 5     | Reminders                    | Not started                                            |
| 6     | Subscriptions and Pro        | Not started                                            |
| 7     | Polish and release prep      | Not started                                            |
| 8     | Launch                       | Not started                                            |
