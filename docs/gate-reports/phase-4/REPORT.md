# Phase 4 — Scanning and photos: gate report

**Result:** PASSED (automated). TC-402 to TC-405 need a real camera or real network changes, so they are manual checks on real devices, listed below. **Date:** 2026-11-16 · **Branch:** `phase-4/scanning`

## What was built

- **Scan (S09):**
  - Opens the system document scanner straight away, single page:
    - iOS: VisionKit, through `react-native-document-scanner-plugin` 2.0.4 (a TurboModule, so New Architecture).
    - Android: the ML Kit document scanner in Google Play services.
  - The scanner finds the receipt's edges and captures it.
  - When the scanner is closed, the screen offers **Scan receipt**, **Choose photo** (the photo library fallback, `expo-image-picker`) and **Enter manually**.
  - **Camera permission (iOS):** the string is "ReturnSafe uses the camera to scan your receipts."
    - When access is denied, the screen explains why, with **Open Settings** and **Enter manually**.
    - Coming back from Settings with access turned on shows **Scan receipt** again.
  - **Camera permission (Android):** the Play services scanner needs no camera permission from the app, so the app asks for none.
  - **Photo library:** the iOS photo string is "ReturnSafe uses your photo library to add a receipt photo." The microphone permission is turned off.
- **Text recognition:**
  - Done on the device, with no network and nothing sent anywhere:
    - iOS: Apple Vision.
    - Android: ML Kit text recognition.
  - Both run through a small local Expo module, `modules/receipt-text`. See Deviations.
  - The recognised lines are put back on their printed rows by position, so a "TOTAL" label and its amount column end up on one line.
- **Parser (`src/features/scan/parseReceipt.ts`):**
  - **Store:** matched against the 51 stores' names and aliases, allowing up to 1 typo for names of 5–7 letters and 2 for longer names. The header lines are preferred.
  - **Date:** US formats (11/12/2026, 11/12/26, Nov 12, 2026, 12 Nov 2026, 2026-11-12). Future dates are rejected.
  - **Total:** taken from TOTAL, AMOUNT DUE or BALANCE DUE (also when the amount sits in its own column or on the next line). SUBTOTAL, TAX, tendered amounts, change and savings are never taken.
  - **Items:** best effort, up to 10 lines that end in a price.
- **Review (S10):**
  - The receipt form opens pre-filled from the scan, with a card showing the photo and "Receipt scanned".
  - The store, date and total each show a **Detected** badge until the user changes them.
  - The return-by date follows the detected store's policy.
  - When nothing useful is read, the card says **"We couldn't read this receipt"** and the empty form keeps the photo attached.
  - **Retake** discards the photo and reopens the scanner.
- **Photos and upload:**
  - The photo is shrunk to at most 2000 px on its longest side, saved as an 80% JPEG and kept on the device.
  - It is uploaded to `users/{uid}/receipts/{receiptId}/{photoId}.jpg`. The receipt saves the path at once, so the receipt is never blocked by the upload.
  - **Upload queue:** saved on the device, so it survives restarts and offline use.
    - It retries with growing waits (2 s, 4 s, 8 s, up to 5 minutes) and again as soon as the app returns to the foreground.
    - Each photo has a fixed id and path, so a retry overwrites the same file and a photo is never queued twice.
  - Receipt detail shows the photo (from the device while still queued, then from Storage) with "Attached".
  - Deleting a receipt cancels its upload and deletes its photo.
- **Storage rules:**
  - Owner only.
  - Receipt photo paths only (`{receiptId}/{photoId}.jpg`).
  - `image/*` content types only, and under 10 MB.
  - Everything else is denied.

## Results

| Test ID | Type | iOS | Android | Notes |
| ------- | ---- | --- | ------- | ----- |
| TC-401 | Unit | Pass | Pass | 30 sample receipts in `tests/fixtures/receipts/` with expected values. Store 100% (need 80), date 100% (need 90), total 100% (need 85). Table below |
| TC-406 | Rules (Storage emulator) | Pass | Pass | A 12 MB image is denied and a PDF is denied. Also: the owner can upload, read and delete a JPEG under 10 MB; re-uploading the same photo overwrites it; other users and signed-out users are denied; paths outside the receipt photo layout are denied |
| G4-1 | Unit | Pass | Pass | Upload queue retries and makes no duplicates: retries with growing waits then uploads once; the same photo is never queued twice (one file in Storage); jobs survive a restart while offline; it retries on returning to the foreground; it waits for the owner and drops a deleted receipt's photo; the wait is capped at 5 minutes |
| G4-2 | Unit | Pass | Pass | Scan and review against fakes for the scanner, text recognition and Storage: Detected badges and save with the photo, unreadable receipt (TC-404 path), recognition failing, a badge clearing on edit, scanner closed, Enter manually, camera denied (TC-403 path), first-time ask, Retake, offline save then upload (TC-405 path), delete removes the photo. Photos are shrunk to 2000 px as 80% JPEGs; OCR columns are rebuilt into rows |
| G4-3 | E2E (Maestro) | Pass | Pass | TC-402 on a simulator, using the photo library because simulators have no camera. A printed-style Walmart receipt (`e2e/assets/walmart-receipt.png`) is picked; the real text recognition and parser run. The review shows "Receipt scanned", Walmart, the date and $89.00, each with Detected, and "90-day Walmart policy" ([iOS](ios-tc402-review.png), [Android](android-tc402-review.png)). After saving, Home shows Walmart $89.00, the Storage emulator holds exactly one file at the path on the receipt, and detail shows the photo with "Attached" ([iOS](ios-tc402-detail.png), [Android](android-tc402-detail.png)) |
| G4-4 | Static | Pass | Pass | ESLint, TypeScript strict (app and functions), Prettier, colour check, expo-doctor 20/20 |
| TC-402 | Manual | — | — | Real Walmart receipt with the real camera (see below) |
| TC-403 | Manual | — | — | Camera denied on a real iPhone (see below); covered by G4-2 |
| TC-404 | Manual | — | — | Blank page with the real camera (see below); covered by G4-2 |
| TC-405 | Manual | — | — | Offline save, then online (see below); covered by G4-1 and G4-2 |

**Totals:**
- **Unit:** 14 suites, 225 tests, 7 snapshots.
- **Rules and functions:** 3 files, 41 tests, run against the Auth, Firestore, Storage and Functions emulators.
- **Maestro:** 17/17 flows on the iPhone 17 Pro Max simulator and 17/17 on the Medium Phone API 36.1 emulator. Earlier phases' flows are included as regression checks. Release builds were built with `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`.

### TC-401 accuracy

The samples are written as text recognition returns them: upper case, stray symbols, broken columns and some typos.

| Sample | Store | Date | Total |
| ------ | ----- | ---- | ----- |
| 01-walmart | ✓ | ✓ | ✓ |
| 02-target | ✓ | ✓ | ✓ |
| 03-costco | ✓ | ✓ | ✓ |
| 04-home-depot | ✓ | ✓ | ✓ |
| 05-lowes | ✓ | ✓ | ✓ |
| 06-best-buy | ✓ | ✓ | ✓ |
| 07-kohls | ✓ | ✓ | ✓ |
| 08-macys | ✓ | ✓ | ✓ |
| 09-tj-maxx | ✓ | ✓ | ✓ |
| 10-marshalls | ✓ | ✓ | ✓ |
| 11-ross | ✓ | ✓ | ✓ |
| 12-old-navy | ✓ | ✓ | ✓ |
| 13-dicks | ✓ | ✓ | ✓ |
| 14-rei | ✓ | ✓ | ✓ |
| 15-ulta | ✓ | ✓ | ✓ |
| 16-cvs | ✓ | ✓ | ✓ |
| 17-walgreens | ✓ | ✓ | ✓ |
| 18-ikea | ✓ | ✓ | ✓ |
| 19-apple | ✓ | ✓ | ✓ |
| 20-staples | ✓ | ✓ | ✓ |
| 21-sams-club | ✓ | ✓ | ✓ |
| 22-petsmart | ✓ | ✓ | ✓ |
| 23-gamestop | ✓ | ✓ | ✓ |
| 24-barnes-noble | ✓ | ✓ | ✓ |
| 25-walmart-ocr-typos | ✓ | ✓ | ✓ |
| 26-target-columns | ✓ | ✓ | ✓ |
| 27-best-buy-faded-header | ✓ | ✓ | ✓ |
| 28-home-depot-no-date | ✓ | ✓ (none expected) | ✓ |
| 29-local-shop | ✓ (no store expected) | ✓ | ✓ |
| 30-costco-balance-due | ✓ | ✓ | ✓ |
| **Accuracy** | **100%** (need 80) | **100%** (need 90) | **100%** (need 85) |

**These samples were written for this project, not taken from real photos.** They test the parser's rules, so 100% here does not mean every real receipt will read perfectly. TC-402 on real receipts is the check that counts. If you send real receipts that read wrongly, they can be added to the samples.

## Manual checks for you

Use a build connected to Firebase (dev project) on a real iPhone and a real Android phone. Android needs Google Play services, which downloads the scanner the first time.

**TC-402: real Walmart receipt.**
1. Open the **Scan** tab. The scanner opens; point it at a Walmart receipt on a flat surface.
2. Let it capture (or tap the shutter), then tap **Save** (iOS) or **Done** (Android).
3. **Pass if** the review screen says "Receipt scanned" and shows:
   - Store Walmart, the receipt's date and the receipt's total, each with **Detected**.
   - Return-by 90 days after the purchase date, with "90-day Walmart policy".
4. Tap **Save receipt**. **Pass if:**
   - It appears on Home.
   - Its detail shows the photo with "Attached".
   - In the Firebase console, Storage holds one photo under `users/<uid>/receipts/<receiptId>/`.

**TC-403: camera denied (iPhone).**
1. Delete and reinstall the app (or Settings → ReturnSafe → Camera off).
2. Open **Scan** and tap **Don't Allow** on the camera prompt.
3. **Pass if** the screen explains that the camera is needed and shows **Open Settings** and **Enter manually**.
4. Tap **Enter manually**. **Pass if** the empty New receipt form opens and a receipt can be saved.
5. Open **Scan** again and tap **Open Settings**. **Pass if:**
   - ReturnSafe's Settings page opens.
   - After turning Camera on and returning to the app (iOS may restart it), opening **Scan** starts the scanner.

On Android, Play services' scanner handles the camera itself, so the app never asks for it.

**TC-404: blank page.**
1. Open **Scan** and scan a blank sheet of paper.
2. **Pass if:**
   - The review says **"We couldn't read this receipt"**, shows the photo and the form is empty with no Detected badges.
   - After filling in the store, date and total and saving, the receipt's detail shows the photo with "Attached".

**TC-405: save offline, then online.**
1. Turn on airplane mode.
2. Scan a receipt and save it. **Pass if** it shows on Home at once (with "Waiting to sync") and its detail shows the photo.
3. Turn airplane mode off and keep the app open for about 30 seconds.
4. **Pass if:**
   - In the Firebase console, the receipt's folder in Storage has exactly **one** photo.
   - The photo still shows after reinstalling the app or opening it on another device.

## Deviations

- **Text recognition library.** The plan named `@react-native-ml-kit/text-recognition`, which is not built for the New Architecture. The next option, Infinite Red's ML Kit package, links Google ML Kit's iOS libraries. Those libraries exclude arm64 simulators, so the app could no longer build for any simulator on an Apple Silicon Mac.
  - Text recognition is instead a small local Expo module (`modules/receipt-text`, about 100 lines): Apple Vision on iOS and Google ML Kit on Android. Both are free, run on the device and work offline.
  - It is an Expo module, so it supports the New Architecture and needs no manual native edits.
- **51 stores** (from Phase 3: Nordstrom Rack is its own store).

## Fixed during testing

- **Android emulator scanner:** with no internet, Play services shows "Something went wrong" while downloading the scanner. The app treats this like a closed scanner (Scan receipt, Choose photo, Enter manually), and the E2E flow cancels it.
- **Android flows that open Scan:** the earlier flows that go Scan → Enter manually got stuck on the offline Play services screen. They now share one step (`e2e/subflows/open-scanner.yaml`) that waits for the scanner screen and cancels that screen if it appears.
- **Android photo picker:** some versions select first and confirm with **Done**; the E2E flow handles both.

## Notes

- **Items are best effort:** on the simulator, iOS read "AIR FRYER 5.8QT" as "5.80T". Item names are shown for the user to check and never affect the deadline.

- **Ports:** the Storage emulator is on **9199** (Firestore still 8180).
- **Adding the test receipt to a simulator:** see the README's End-to-end tests section.
