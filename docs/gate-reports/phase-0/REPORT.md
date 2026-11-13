# Phase 0 — Foundation: gate report

**Result:** PASSED · **Date:** 2026-11-13 · **Branch:** `phase-0/foundation`

## Environment

| Item          | Version                                      |
| ------------- | -------------------------------------------- |
| Expo SDK      | 58 (expo 58.0.25)                            |
| React Native  | 0.88.1 (New Architecture)                    |
| macOS / Xcode | 27.2.1 / 27.2                                |
| iOS target    | Simulator, deployment target 16.4            |
| Android       | Emulator Medium_Phone_API_36.1               |
| Node          | 22 (CI)                                      |
| Firebase      | @react-native-firebase/app 27, project `returnsafe-app` (dev) |

## Results

| Test ID | Type                                      | iOS  | Android | Notes                                                      |
| ------- | ----------------------------------------- | ---- | ------- | ---------------------------------------------------------- |
| TC-001  | Dev build installs and launches           | Pass | Pass    | Placeholder renders; screenshots in this folder            |
| G0-1    | `npm run lint`                            | Pass | Pass    | ESLint 9 flat config, 0 warnings                           |
| G0-2    | `npm run typecheck`                       | Pass | Pass    | TypeScript strict                                          |
| G0-3    | `npm run format:check`                    | Pass | Pass    | Prettier                                                   |
| G0-4    | `npm test`                                | Pass | Pass    | 1 suite, 1 test                                            |
| G0-5    | `npx expo-doctor`                         | Pass | Pass    | 20/20 checks                                               |
| G0-6    | `expo prebuild --clean` is reproducible   | Pass | Pass    | No drift in tracked files; native folders are gitignored   |
| G0-7    | GitHub Actions CI                         | Pass | Pass    | lint, typecheck, format, test on Node 22                   |
| G0-8    | Bundle ID / package `com.returnsafe.app`  | Pass | Pass    | Matches Firebase config files                              |

## Evidence

- [iOS TC-001](ios-tc001.png)
- [Android TC-001](android-tc001.png)

## Notes

- iOS needs Xcode 26.4 or newer for Expo SDK 58. CocoaPods needs a UTF-8 locale (see README → Local setup).
- React Native Firebase needs `useFrameworks: 'dynamic'` on iOS.
- Firestore and Storage rules deny all access until Phase 2 adds auth-scoped rules.
