# App Privacy (Apple) and Data safety (Google Play) answers

These answers are based on what the app actually sends (see `src/lib/telemetry.ts`, `firebase.json`, `app.config.ts › ios.privacyManifests`) and on the [privacy policy draft](../legal/privacy-policy.md). If the app starts collecting anything new, update all three together.

## Apple: App Store Connect › App Privacy

- **Tracking:** **No.** The app doesn't track users. It has no IDFA (Analytics is built without ad-ID support), no ATT prompt, no data brokers and no third-party ads. `NSPrivacyTracking` is `false` in the privacy manifest.
- **Data collection:** **Yes, we collect data.**

| Data type (Apple) | Collected | Linked to user | Used for tracking | Purposes |
| --- | --- | --- | --- | --- |
| Contact Info › Email Address | Yes | Yes | No | App Functionality |
| Contact Info › Name | Yes (optional) | Yes | No | App Functionality |
| User Content › Photos or Videos | Yes (receipt photos) | Yes | No | App Functionality |
| User Content › Other User Content | Yes (receipt details: store, date, amount, items, warranty) | Yes | No | App Functionality |
| Purchases › Purchase History | Yes (Pro subscription status via RevenueCat) | Yes | No | App Functionality |
| Identifiers › User ID | Yes (Firebase uid, RevenueCat app user id) | Yes | No | App Functionality |
| Diagnostics › Crash Data | Yes (Crashlytics) | No | No | App Functionality |
| Usage Data › Product Interaction | Yes (7 fixed events, no parameters about the user) | No | No | Analytics |

Not collected: Location, Health & Fitness, Financial Info (no card or bank data; amounts on receipts are User Content), Contacts, Browsing/Search History, Sensitive Info, Device ID (no IDFA or IDFV collection: `google_analytics_idfv_collection_enabled: false`), Performance Data, Other Diagnostic Data, Advertising Data.

**Why these choices:**

- **Linked to user:** email, name, photos, receipts, purchases and user ID are stored under the user's account, so they are linked.
- **Crash Data and Product Interaction are not linked:** Crashlytics and Analytics never receive the user ID (`setUserId` is never called), and events carry no account data.
- **Receipt amounts:** Apple's "Financial Info" covers payment and credit information. The amounts on the user's own receipts are user-entered content, so they go under Other User Content.

These answers match `ios.privacyManifests.NSPrivacyCollectedDataTypes` in `app.config.ts`. Run `npm run check:privacy -- <app>` on each release build.

## Google Play: Play Console › App content › Data safety

### Overview

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (TLS to Firebase and RevenueCat) |
| Do you provide a way for users to request that their data is deleted? | **Yes**, in the app and at https://getreturnsafe.com/delete-account |
| Account creation | Users can create an account; login methods: username and password, OAuth (Google), other (Sign in with Apple); also anonymous guest |
| Delete account URL | https://getreturnsafe.com/delete-account |

**Sharing:** no data is shared. Google Play doesn't count transfers to service providers that process data for us (Firebase, RevenueCat) as sharing.

### Data types

| Category › Type | Collected | Shared | Ephemeral | Required / optional | Purposes |
| --- | --- | --- | --- | --- | --- |
| Personal info › Name | Yes | No | No | Optional | App functionality, Account management |
| Personal info › Email address | Yes | No | No | Optional (guest mode needs none) | App functionality, Account management |
| Personal info › User IDs | Yes | No | No | Required | App functionality, Account management |
| Financial info › Purchase history | Yes | No | No | Required for Pro | App functionality |
| Photos and videos › Photos | Yes | No | No | Optional | App functionality |
| Files and docs | No | | | | |
| App activity › App interactions | Yes | No | No | Required | Analytics |
| App activity › Other user-generated content | Yes (receipt details) | No | No | Required | App functionality |
| App info and performance › Crash logs | Yes | No | No | Required | Analytics (stability) |
| App info and performance › Diagnostics | Yes (Crashlytics device/OS info) | No | No | Required | Analytics (stability) |
| Device or other IDs | Yes (Firebase Installation ID and FCM push token) | No | No | Required | App functionality (push reminders), Analytics |

Not collected: location, contacts, calendar, messages, audio, health and fitness, web browsing, installed apps, search history, payment info (cards are handled by Google Play).

**Notes for the form:**

- **Ephemeral:** "No" everywhere, because data is stored. Receipt text recognition happens on the device and the camera frames aren't sent anywhere, so they aren't "collected".
- **Advertising ID:** Firebase Analytics on Android declares no `AD_ID` use (`google_analytics_adid_collection_enabled: false`). In Play Console › App content › Advertising ID, answer **No**, and confirm the merged manifest has no `com.google.android.gms.permission.AD_ID` permission. If it does, add a `tools:node="remove"` override through a config plugin.
- **Families policy:** the target audience excludes under-13s, so the Families policy doesn't apply.
