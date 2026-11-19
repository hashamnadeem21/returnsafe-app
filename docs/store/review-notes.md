# App Review notes and demo account

## Before submitting: create the demo account (production project)

1. In the production build, sign up with **email:** `[appreview@getreturnsafe.com]`, **password:** [a strong password stored in the team password manager, never committed].
2. Add 4 receipts so every screen has content. Take one with Scan, and enter the rest manually:
   - **Target:** today − 5 days, $48.99, 30-day window.
   - **Best Buy:** today − 12 days, $129.00, 15-day window, so it's due soon.
   - **Amazon:** today − 40 days, $23.50, 30-day window. Mark it **Kept**.
   - **Walmart:** today − 2 days, $15.00, 90-day window.
3. Leave the account on **Free**. Reviewers test Pro with their own sandbox account; the paywall shows sandbox prices.
4. Turn reminders on and allow notifications.
5. Check the account works on a clean install before each submission. Reviewers may delete it as part of testing account deletion; if they do, re-create it.

## App Store Connect › App Review Information

- **Sign-in required:** Yes.
- **User name:** `[appreview@getreturnsafe.com]`
- **Password:** [from the password manager]
- **Contact:** [first name, last name, phone, email]

**Notes** (paste; under 4000 characters):

```
ReturnSafe keeps shopping receipts and reminds users before store return windows close.

DEMO ACCOUNT
Sign in with the credentials above: Welcome › "Continue with email" › "Already have an account? Log in". The account has 4 sample receipts.
You can also tap "Continue as guest" on the Welcome screen to try the app without an account.

HOW TO TEST
1. Scan: tap the Scan tab, photograph any paper receipt (or tap "Enter manually"). Text is read on the device.
2. Reminders: a reminder is scheduled the day before a return deadline at the time set in Settings › Reminders. Notifications are requested only after the app explains why (a primer screen).
3. Mark a receipt Returned or Kept from its detail screen.
4. ReturnSafe Pro (auto-renewable subscriptions "rs_pro_yearly" with a 7-day free trial and "rs_pro_monthly", one subscription group): the upgrade banner at the top of Settings, or the Warranties tab. Prices come from StoreKit. "Restore purchases" is on the paywall. Terms of Use and Privacy Policy links are on the paywall and in the app description.
5. Account deletion: Settings › Account › Delete account. It deletes the account and all data on our servers immediately (re-authentication may be required).

OTHER
- Sign in with Apple is offered alongside Google sign-in.
- No tracking, no ads, no ATT prompt. Camera and photo library are used only to add receipt photos; every permission has a fallback (manual entry).
- Available in the United States only.
```

**Attachment (optional):** a 30-second screen recording of scan → reminder → paywall helps reviewers.

## Google Play › App content › App access

- Select **All or some functionality is restricted** and add instructions:
  - **Name:** Demo account
  - **Username:** `[appreview@getreturnsafe.com]`
  - **Password:** [from the password manager]
  - **Any other information:** "Log in from Welcome › Continue with email › Already have an account? Log in. Guest mode (Continue as guest) also works without an account. Pro can be tested with a license-tester account; prices come from Google Play."
- Add the reviewer and closed-test emails as **License testers** (Play Console › Settings › License testing), so subscriptions can be bought without charges.

## Checklist before pressing Submit

- [ ] Demo account signs in on a clean install of the build under review.
- [ ] Both subscriptions are attached to the version (iOS: "In-App Purchases and Subscriptions" section of the version page).
- [ ] Privacy Policy URL, Terms (EULA) and Support URL are live (drafts in `docs/legal/`).
- [ ] App Privacy and Data safety are filled from `docs/store/privacy-answers.md`.
- [ ] Export compliance: `ITSAppUsesNonExemptEncryption = false` (already in the build). Answer "None of the algorithms mentioned above" for standard HTTPS only.
- [ ] Age rating 4+ (iOS) / IARC questionnaire done (Play).
- [ ] Availability: United States only.
