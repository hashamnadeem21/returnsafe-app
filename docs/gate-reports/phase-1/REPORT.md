# Phase 1 — Design system and navigation: gate report

**Result:** PASSED (automated) · TC-104 and TC-105 are manual checks for the owner · **Date:** 2026-11-13 · **Branch:** `phase-1/design-system`

## What was built

- `src/theme/tokens.ts`: light and dark colour tokens from the design PDF, the Inter type scale (Display 28/34 to Label 12/16), a 4-point spacing grid with 20 pt screen padding, and radii (card 16, button 14, input 12, chip full). It is the only file in `src/` with hex colours.
- Inter 400/500/600/700/800 is loaded with expo-font. The native splash stays up until the fonts and the onboarding flag are ready.
- Components: Button (primary, secondary, soft, danger, text, disabled, loading), TextField (focus, error, helper, secure toggle), Card (1 px border plus iOS shadow or Android elevation), Chip (on/off with count), Pill (red 0–2 days, amber 3–7, gray 8+, green, teal), ListRow with a letter avatar, Banner (warn, info, offline), Sheet, EmptyState, CountdownRing, ProLock, Skeleton, ScreenHeader, and a custom TabBar with a raised Scan button.
- Expo Router: an `(auth)` stack (onboarding, welcome, sign-up, log-in, forgot-password, notification-primer) and `(tabs)` (home, receipts, scan, warranties, settings). Also `receipt/new`, `receipt/[id]`, `receipt/[id]/edit`, the paywall (modal), the scanner (full-screen modal), `settings/reminders`, `settings/account` and `settings/delete-account`. Screens that later phases build show a placeholder that names the phase.
- Onboarding (3 cards) shows only on first launch. The flag is saved in AsyncStorage.
- Dark mode follows the system.

## Results

| Test ID | Type             | iOS  | Android | Notes                                                                                                  |
| ------- | ---------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------ |
| TC-101  | E2E (Maestro)    | Pass | Pass    | Fresh install shows onboarding; after Skip and a relaunch it does not show again (`e2e/tc-101-onboarding.yaml`) |
| TC-102  | E2E (Maestro)    | Pass | Pass    | Every tab title is visible; Scan opens the scanner modal and closes back to Home (`e2e/tc-102-tabs.yaml`) |
| TC-103  | Unit             | Pass | Pass    | Disabled and loading buttons never call onPress; spinner shows; snapshots of all 7 states              |
| G1-1    | Unit             | Pass | Pass    | All 25 component cases render in both light and dark themes (50 renders)                               |
| G1-2    | Lint             | Pass | Pass    | `npm run lint:colors`: no hex colours outside `tokens.ts` (proved by failing a deliberate probe)        |
| G1-3    | Unit             | Pass | Pass    | Router tests: onboarding flag, redirect after Skip, every tab title, Scan modal                        |
| G1-4    | Unit             | Pass | Pass    | Tokens match the spec type scale, radii and spacing; light and dark define the same keys               |
| G1-5    | Static           | Pass | Pass    | ESLint, TypeScript strict (with typed routes), Prettier, expo-doctor 20/20                             |
| G1-6    | CI               | Pass | Pass    | GitHub Actions now also generates route types and runs the colour check                                |
| TC-104  | Manual           | —    | —       | Owner check (steps below). Pre-check: dark tokens render on both platforms                             |
| TC-105  | Manual           | —    | —       | Owner check (steps below). Pre-check: Android at the largest text size shows no clipping               |

Unit totals: 5 suites, 73 tests, 7 snapshots. The E2E runs used Release builds (JS bundled, no Metro) on the iPhone 17 Pro Max simulator and the Medium Phone API 36.1 emulator. The JUnit results are in this folder.

## Manual checks for you

**TC-104: dark mode.** On an iPhone and an Android phone:

1. Install the latest build and open ReturnSafe.
2. Turn on dark mode (iOS: Settings → Display & Brightness → Dark. Android: Settings → Display → Dark theme).
3. Go through every screen: onboarding (delete and reinstall to see it again), Welcome, Continue with email, and back. Then Continue as guest, each of the 5 tabs, and Scan (close it with ×).
4. Pass if every background is dark navy, all text is light and readable, and nothing flashes white when you switch screens.

**TC-105: largest text.**

1. iOS: Settings → Accessibility → Display & Text Size → Larger Text, with the slider at the largest standard step (not the extra accessibility sizes). Android: Settings → Display → Font size, set to the maximum.
2. Reopen ReturnSafe and go through the same screens as in TC-104.
3. Pass if no text is cut off or overlapping, the tab labels (Home, Receipts, Scan, Warranties, Settings) still fit, and the buttons still show their full labels. Text stops growing at 1.4× by design.

## Evidence

- [iOS onboarding (light)](ios-onboarding-light.png) · [iOS onboarding (dark)](ios-onboarding-dark.png) · [iOS Home](ios-home.png)
- [Android Home](android-home.png) · [Android Welcome (dark, largest text)](android-welcome-dark-large-text.png)
- [Maestro iOS results](maestro-ios.xml) · [Maestro Android results](maestro-android.xml)

## Notes

- Code review (5 minor findings) was fixed before merge: the colour check now handles paths with spaces, onboarding still exits if saving the flag fails, Welcome scrolls at large text sizes, the Sheet's VoiceOver boundary includes Close with escape support, and the dark-mode danger button label now has about 5.9:1 contrast. All checks and both E2E runs were repeated after the fixes.

- The Sheet is built on React Native's `Modal` rather than `@gorhom/bottom-sheet`. Bottom-sheet 5 has not been verified against react-native-gesture-handler 3 in this SDK, and a plain modal sheet covers what the spec needs without another native dependency.
- The Welcome screen is a Phase 1 shell. Apple and Google sign-in and real guest (anonymous) login arrive in Phase 2. Until then, "Continue as guest" goes straight to the tabs.
- Maestro 2.12.1 is installed in `~/.maestro/maestro/bin`, checksum-verified against the official release.
