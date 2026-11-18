# ReturnSafe Pro: store and RevenueCat setup

ReturnSafe Pro is one entitlement (`pro`) sold as two auto-renewing subscriptions:

| Product ID       | Price (US) | Period | Trial               |
| ---------------- | ---------- | ------ | ------------------- |
| `rs_pro_yearly`  | $19.99     | 1 year | 7 days free         |
| `rs_pro_monthly` | $2.99      | 1 month| none                |

The app never hard-codes these prices; it shows whatever the store returns. Set everything up in the order below. Work in the dev Firebase project (`returnsafe-app`, alias `dev` in `.firebaserc`) first, then repeat the webhook part for **returnsafe-prod**.

## 1. App Store Connect (iOS)

1. **Agreements, Tax, and Banking:** accept the **Paid Applications** agreement and finish the tax and bank forms. Subscriptions don't load, even in sandbox, until this agreement is active.
2. **App record:** make sure the app `com.returnsafe.app` exists under **Apps**. In-App Purchase is on for every App ID by default; there is nothing to turn on in Xcode.
3. **Subscription group:** open the app, go to **Monetization › Subscriptions**, and create a group named `ReturnSafe Pro`. Add the group's display name (en-US): "ReturnSafe Pro".
4. **Yearly subscription:** in the group, click **+**.
   - Reference name `Pro Yearly`, Product ID `rs_pro_yearly`.
   - Subscription duration **1 year**.
   - **Availability:** United States only.
   - **Subscription prices:** base country United States, **$19.99**.
   - **Localization (en-US):** display name "Pro Yearly", description "Unlimited receipts, warranties and export".
   - **Review information:** a screenshot of the paywall and a note: "Unlocks unlimited receipts, warranty tracking, extra photos, 7/3-day reminders and export."
   - **Introductory offers:** **+** › United States › start date today, no end date › **Free** › duration **1 week**.
5. **Monthly subscription:** repeat with Product ID `rs_pro_monthly`, duration **1 month**, price **$2.99**, US only. No introductory offer.
6. **Level order:** in the group, put Yearly at level 1 and Monthly at level 2, so switching to Yearly counts as an upgrade.
7. **In-App Purchase key for RevenueCat:** **Users and Access › Integrations › In-App Purchase › Generate In-App Purchase Key**. Download the `.p8` file once and note the Key ID and Issuer ID.
8. **App Store Server Notifications:** **App Information › App Store Server Notifications**, set both Production and Sandbox URLs to the URL RevenueCat shows in step 3.3 below (Version 2).

The first subscription must be submitted together with an app version. Until then, products in "Ready to Submit" still work in sandbox.

## 2. Google Play Console (Android)

1. **Payments profile:** **Settings › Payments profile** must be set up (a merchant account) before you can create subscriptions.
2. **Upload a build with billing:** subscriptions can only be created after an AAB with the Play Billing library is uploaded to a track. Upload a build from `eas build --platform android --profile preview` to **Testing › Internal testing**. RevenueCat's SDK already adds the `com.android.vending.BILLING` permission.
3. **Yearly subscription:** **Monetize with Play › Products › Subscriptions › Create subscription**.
   - Product ID `rs_pro_yearly`, name "Pro Yearly".
   - **Add base plan:** ID `yearly`, **Auto-renewing**, billing period **1 year**, grace period **7 days**, account hold **30 days**, resubscribe allowed.
   - **Prices:** set United States to **$19.99**. Under **Countries / regions**, make only the United States available.
   - **Activate** the base plan.
   - **Add offer** on the `yearly` base plan: offer ID `free-trial`, eligibility **New customer acquisition › Never had this subscription**, phase **Free trial, 7 days**. Activate it.
4. **Monthly subscription:** product ID `rs_pro_monthly`, base plan ID `monthly`, **Auto-renewing**, **1 month**, United States **$2.99**, same grace and hold settings. No offer. Activate.
5. **Real-time developer notifications:** follow RevenueCat's "Google Real-Time Developer Notifications" guide. Create a Pub/Sub topic, grant `google-play-developer-notifications@system.gserviceaccount.com` the Publisher role, and paste the topic into **Monetize with Play › Monetization setup**.
6. **Service account for RevenueCat:** in Google Cloud, create a service account. Give it **Pub/Sub Admin** and **Monitoring Viewer**, and download a JSON key. In Play Console, **Users and permissions › Invite new users** with that email, and grant **View financial data** and **Manage orders and subscriptions** for the app. It can take up to 36 hours to start working.

## 3. RevenueCat

1. **Project:** create a project named "ReturnSafe".
2. **Apps:**
   - Add an **App Store** app with bundle ID `com.returnsafe.app`, and upload the In-App Purchase key (`.p8`, Key ID, Issuer ID).
   - Add a **Play Store** app with package `com.returnsafe.app`, and upload the service account JSON.
3. **Copy RevenueCat's Apple server notification URL** from the App Store app's settings. Paste it in App Store Connect (step 1.8 above).
4. **Entitlement:** **Product catalog › Entitlements › New**, identifier `pro`.
5. **Products:** import or add:
   - `rs_pro_yearly` and `rs_pro_monthly` (App Store).
   - `rs_pro_yearly:yearly` and `rs_pro_monthly:monthly` (Play Store).

   Attach all four to the `pro` entitlement.
6. **Offering:** **Product catalog › Offerings › New**, identifier `default`, and mark it **Current**. Add these packages:
   - `$rc_annual` with `rs_pro_yearly` (App Store) and `rs_pro_yearly:yearly` (Play Store).
   - `$rc_monthly` with `rs_pro_monthly` (App Store) and `rs_pro_monthly:monthly` (Play Store).
7. **API keys:** **Project settings › API keys** has one public key per app (`appl_…` and `goog_…`).
   - Put them in `.env` as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
   - Add the same two to EAS for cloud builds: `eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_… --environment production` (repeat for the Android key, and for `preview`).
8. **Webhook (one per Firebase project):**
   1. Make a long random secret: `openssl rand -hex 32`.
   2. Store it in Firebase: `firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET --project dev`, and paste the secret when asked.
   3. Deploy the function, rules and indexes: `firebase deploy --only functions,firestore --project dev`.
   4. In RevenueCat, **Integrations › Webhooks › Add**:
      - URL: `https://us-central1-returnsafe-app.cloudfunctions.net/revenueCatWebhook`
      - Authorization header value: `Bearer <the secret>`. Include the word `Bearer` and the space; anything else gets a 401.
      - Environment: **Sandbox** for dev (both for prod).
      - Events: all.
   5. Click **Send test event**. The function answers 200 with `{"outcome":"ignored"}`; TEST events change nothing.

## 4. Test accounts

### Apple sandbox account (TC-601, 602, 603, 606, 608 on iPhone)

1. In App Store Connect, go to **Users and Access › Sandbox › Test Accounts** and click **+**. Use an email address that has never been an Apple ID; a `+` alias of your own email works (for example `you+rs1@gmail.com`). Set the country to **United States**.
2. On the iPhone, go to **Settings › Developer › Sandbox Apple Account** and sign in with it. To see the Developer menu, connect the phone to Xcode once. Your real Apple ID stays signed in for everything else.
3. Sandbox time is faster: 1 week = 3 minutes, 1 month = 5 minutes, 1 year = 1 hour, and a subscription renews up to 12 times.
4. To test the trial again, open **Settings › Developer › Sandbox Apple Account › Manage** and clear the purchase history, or create a new sandbox account.

### Google Play license tester (the same tests on Android)

1. In Play Console, go to **Settings › License testing** and add the Gmail address signed in on the test phone. Set the license response to **RESPOND_NORMALLY**.
2. Add the same address to the internal testing track's testers. Open the opt-in link on the phone and accept.
3. Install the app from that track's Play Store link, or install a build signed with the same key and package.
4. Test purchases show "Test card, always approves" and cost nothing. Renewals are faster: 1 month = 5 minutes, 1 year = 30 minutes, free trial = 3 minutes.
5. To test **pending** (TC-602 variant), choose "Slow test card, approves after a few minutes".

## 5. What the app and server do

- **Signing in:** the app signs RevenueCat in as the Firebase uid, and signs out with the user. Pro bought on one phone therefore comes back on any phone after sign-in, without tapping Restore (TC-603).
- **The UI** unlocks from RevenueCat's customerInfo right away.
- **Rules and functions** only trust `users/{uid}.isPro`, which only the webhook writes:
  - INITIAL_PURCHASE, RENEWAL, UNCANCELLATION and PRODUCT_CHANGE: Pro until the new expiry.
  - CANCELLATION: Pro stays until the paid period ends.
  - BILLING_ISSUE: Pro stays through the grace period.
  - EXPIRATION: Pro ends.
  - TRANSFER: Pro moves to the account that restored it.
- **Duplicates and late events:** every event is recorded in `billingEvents/{eventId}`, so a repeat delivery changes nothing. An older event that arrives late cannot undo a newer one.
