# Releasing ReturnSafe

How to make production builds, put them in front of testers, and ship JavaScript-only fixes with EAS Update. Do the one-time setup first.

## 1. One-time setup

### 1.1 EAS project

```bash
npm install -g eas-cli
eas login
eas init            # creates the EAS project and prints its id
```

`eas init` tries to write `extra.eas.projectId` into the config. `app.config.ts` is dynamic, so it can't. Instead, put the id in an environment variable so that config reads it:

- **EAS builds:** `eas env:create --name EAS_PROJECT_ID --value <id> --environment production --environment preview --environment development --visibility plaintext`
- **Local builds:** `export EAS_PROJECT_ID=<id>`

`EAS_PROJECT_ID` turns on over-the-air updates (`updates.url`). Builds made without it never look for updates.

### 1.2 Production Firebase project

1. Create the Firebase project **returnsafe-prod** (Blaze plan, region `us-central1`), and add it to `.firebaserc` as alias `prod`.
2. Add an iOS app (`com.returnsafe.app`) and an Android app (`com.returnsafe.app`). Download `GoogleService-Info.plist` and `google-services.json` into `firebase/prod/`. They are git-ignored, so upload them to EAS as file secrets:
   ```bash
   eas env:create --name GOOGLE_SERVICES_PLIST --type file --value firebase/prod/GoogleService-Info.plist --environment production
   eas env:create --name GOOGLE_SERVICES_JSON --type file --value firebase/prod/google-services.json --environment production
   ```
3. Enable Authentication providers: Email/Password, Apple, Google and Anonymous.
4. Deploy everything from the repo:
   ```bash
   firebase use prod
   firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET
   firebase deploy --only firestore,storage,functions
   ```
   `functions/.env.returnsafe-prod` sets `ENFORCE_APP_CHECK=true` for this project only, so its callable functions reject requests that have no App Check token.
5. **App Check** (Firebase console › App Check):
   - **iOS app:** register **App Attest**, and **DeviceCheck** as the fallback, using your Team ID, an App Attest key and a DeviceCheck key.
   - **Android app:** register **Play Integrity**. Link the Google Cloud project in Play Console › App integrity, and add the app signing key's SHA-256.
   - Watch the **Metrics** tab for a day of TestFlight/closed-test traffic. Then click **Enforce** for **Cloud Firestore** and **Cloud Storage**. Callable functions are already enforced by `ENFORCE_APP_CHECK`.
   - TC-705 checks enforcement: a Firestore REST call without an App Check token must be rejected.
6. **Backups and budget:** turn on Firestore point-in-time recovery and a daily backup schedule (`gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14d`). Add a Cloud Billing budget with alerts at 50%, 90% and 100%.
7. **Crashlytics and Analytics:** both are on by default in a new project. The app enables collection only in release builds that don't point at the emulators.

### 1.3 Stores

Follow `docs/subscriptions-setup.md` for App Store Connect, Play Console and RevenueCat. For the store listing, App Privacy, Data safety and review notes, use the drafts in `docs/store/`.

## 2. Production builds

```bash
eas build --profile production --platform all
```

- **Versions:** `appVersionSource: remote` with `autoIncrement` gives each build a new build number (iOS) and versionCode (Android). The marketing version comes from `version` in `app.config.ts`.
- **Release channel:** the production profile sets `APP_ENV=production`, which selects the app name "ReturnSafe", `firebase/prod`, and the production `channel`.
- **iOS signing:** on the first iOS build, EAS asks to log in to Apple and creates the distribution certificate and provisioning profile. It also creates the push key for Firebase Cloud Messaging; upload that APNs key in Firebase › Project settings › Cloud Messaging.
- **Android signing:** on the first Android build, EAS creates the upload keystore. Play App Signing then holds the release key.

### TestFlight

```bash
eas submit --platform ios --profile production --latest
```

In App Store Connect › TestFlight, add an internal group (up to 100 people, no review). For outside testers, add an external group (needs Beta App Review).

### Google Play closed testing

New personal developer accounts need a closed test with **at least 12 testers opted in for 14 days in a row** before production access is granted.

1. Play Console › Testing › Closed testing › Create track. Add an email list of 12+ testers and copy the opt-in link to them.
2. Upload the first build by hand (Play needs one manual upload), then use:
   ```bash
   eas submit --platform android --profile production --latest
   ```
   Set `submit.production.android.track` to `alpha` (closed) in `eas.json` once a service-account key is configured.
3. Keep all 12+ testers opted in for 14 days, then apply for production access.

## 3. Shipping a JavaScript-only fix (EAS Update)

`runtimeVersion` uses the **appVersion** policy, so the runtime version is the app's `version` (for example `1.0.0`). An update reaches only builds with that exact version, which have the same native code. Builds on any other version ignore it; TC-706 checks this.

**Use an update only when the change touches JavaScript or assets alone.** Any change to the following needs a new store build and a version bump instead:

- native packages, or `npx expo install` of a module with native code;
- config plugins or `app.config.ts` fields that land in native files (permissions, entitlements, icons, splash);
- Firebase config files.

Steps for a JavaScript-only fix:

1. Fix it on a branch, run `npm run check` and the relevant Maestro flows, and merge.
2. Publish to the production channel from `main`:
   ```bash
   git checkout main && git pull
   APP_ENV=production eas update --channel production --environment production --message "Fix: <what>"
   ```
3. Installed production builds with the same `version` download the update on their next launch (`checkAutomatically: ON_LOAD`) and apply it on the launch after that.
4. Check the rollout in the EAS dashboard › Updates, and watch Crashlytics for the new update id.

**Rollback:** `eas update:rollback --channel production` (or republish the previous group with `eas update:republish`).

**Staged rollout:** `eas update --channel production --rollout-percentage 10 …`, then raise it with `eas update:edit`.

When the next native release ships, bump `version` in `app.config.ts`. The new build gets a new runtime version and no longer receives updates published for the old one.

## 4. Release checklist (each store release)

- `npm run check`, `npm run coverage`, `npm run coverage:functions` and `npx expo-doctor` pass.
- The full Maestro suite passes on iOS and Android (`npm run e2e:ios`, `npm run e2e:android`).
- `npm run check:privacy -- <path to the built .app>` passes.
- `version` is bumped if any native code changed since the last store release.
- `firebase deploy --only firestore,storage,functions -P prod` is run if rules or functions changed.
- After release: check Crashlytics crash-free users and the Analytics funnel (`onboarding_complete`, then `sign_up`, then `receipt_added`).
