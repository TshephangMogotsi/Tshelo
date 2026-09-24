# Google Play release tracker

Last updated: 24 September 2026

This is the working record for the Tshelo Android release. It intentionally
does not contain reviewer credentials, API keys, or other secrets.

## Current release state

- Application ID: `com.tshelo.app`
- Existing Play build: version code **11**, version name **1.0.1**
- Existing track: **Internal testing**, available to internal testers
- Existing build status: the current build does **not** contain the dedicated
  Google Play reviewer sign-in option added after version code 11.
- Store name: **Tshelo**; Google will replace the temporary
  `com.tshelo.app (unreviewed)` install label after required setup and review
  are complete.

## Google Play Console changes

### Completed or entered

- [x] Internal test release created with the version-11 Android App Bundle.
- [x] Public privacy-policy URL entered:
  `https://app.tshelo.com/legal/privacy`
- [x] Sign-in details created as **Google Play reviewer access**.
  - Reviewer access is provided through a dedicated, reusable reviewer account.
  - The Play Console entry explains the in-app **Google Play reviewer access**
    route and that money-moving actions are restricted.
- [x] Ads declaration: **No, the app does not contain ads**.
- [x] Government-app declaration: **No**.
- [x] Health-app declaration: no health features selected.
- [x] Store category: **App → Finance**.
- [x] Store-listing contact email: `tshelo@data-sentinels.com`.
- [x] Store-listing website: `https://tshelo.com`.
- [x] Content-rating category: **All Other App Types**.
- [x] Content-rating contact: `tshelo@data-sentinels.com`.
- [x] Content-rating selections made:
  - No ratings-relevant content in the downloaded package.
  - User interaction/content exchange: Yes, for invite-only workspace sharing.
  - Shared user content is not the primary app content.
  - Public nudity: No.
  - Public graphic real-world violence: No.
  - Blocking capability: Yes, via platform moderation controls.
  - User reporting: No user-facing report feature.
  - Chat moderation: No chat feature.
  - Invite-only interactions: Yes.
  - Online content: Yes, because workspace data/files are loaded after install.
  - Violence, sexuality/nudity, offensive language, and controlled substances:
    No.
  - Promotion/sale of age-restricted products or activities: No.
  - Precise location sharing: No.
  - Digital goods: Yes, because tokens unlock in-app digital features.
  - Cash rewards, gift cards, play-to-earn, crypto rewards, or NFTs: No.
  - Browser/search engine: No.
  - News/educational product: No.
- [x] Target audience: **18 and over** only.
- [x] Google Play restriction for users determined to be minors: enabled.
- [x] Financial features declaration completed with only:
  - **Rewards, points, frequent flier miles, and other incentives** — Tshelo
    has non-cash trust points and rewards.
  - **Crowdfunding and chit funds** — Tshelo organises community funds and
    shared contribution records.
  - Do not select mobile payments/digital wallets or money-transfer services:
    Tshelo records externally completed cash, mobile-money, or bank payments;
    it does not hold, move, send, or receive user money.
  - Do not select loans, banking, credit, buy-now-pay-later, crypto, NFTs,
    stock trading, credit reporting, financial advice, insurance, or Other.
- [x] Data safety declaration started.
  - App collects/shares required user data types: Yes.
  - All data is encrypted in transit: Yes.
  - Normal account creation: username (phone number) plus other authentication
    (SMS one-time password).

### In progress / leave as draft

- [ ] Finish and submit the content-rating questionnaire; verify its generated
  rating on the summary screen before saving.
- [ ] Finish the Data safety declaration.
- [ ] Account-deletion URL: do **not** use the existing privacy-policy page.
  A dedicated public page has been implemented locally at
  `/legal/account-deletion`; it still needs review, commit, and deployment
  before entering `https://app.tshelo.com/legal/account-deletion` in Play
  Console. It includes an email and in-app request path, deleted/retained data
  categories, and a proposed 30-day completion target for verified requests.
- [ ] Data safety data-type and purpose selections still need to be completed
  from the actual app/service data inventory.

## Reviewer-access implementation

- [x] Dedicated reviewer account provisioned in Supabase Auth.
- [x] Reviewer account marked only through server-controlled
  `google_play_reviewer` app metadata.
- [x] Mobile reviewer email/password sign-in route implemented.
- [x] Reviewer account is prevented from executing purchases, payouts,
  mobile-money verification, and token transactions at the database layer.
- [x] Associated Supabase migration applied to the linked database.
- [x] Automated verification passed before the latest small provisioning-script
  adjustment.
- [ ] Commit the reviewer-access code and documentation, excluding unrelated
  local files.
- [ ] Build and upload a new Android App Bundle that contains this sign-in
  route. Its version code must be greater than 11.
- [ ] Add the new bundle to the Internal testing track and manually verify the
  reviewer sign-in route on an Android device.

## Required before a production release

### Store and policy

- [ ] Deploy the dedicated public account-deletion page and enter its URL in
  the Data safety declaration.
- [ ] Complete and submit Data safety, content rating, app-content questions,
  store listing, category/contact details, and all dashboard-required tasks.
- [ ] Ensure the Privacy Policy and Terms explicitly state the adult-only
  audience and the account/data-deletion process.
- [ ] Review the token purchase flow against Google Play Billing policy before
  production. Tshelo sells tokens used for digital in-app features, which is
  declared as digital goods in Play Console.

### Engineering and release verification

- [ ] Run `npm run verify` on the final release commit.
- [ ] Commit and push only intended Tshelo release changes.
- [ ] Produce a new production Android App Bundle with an incremented version
  code and upload it to Google Play.
- [ ] Test install, phone/SMS sign-in, reviewer sign-in, funds/events,
  permissions, notifications, file/receipt handling, privacy links, and error
  states using the exact release bundle.
- [ ] Confirm the reviewer credentials in Play Console work with the released
  build and remain current for future updates.
- [ ] Review the generated Play store preview, data-safety labels, and
  content-rating label before sending any production release for review.

## Notes

- Internal testing can continue while the declarations remain drafts, but a
  production submission cannot be completed until the outstanding dashboard
  requirements are satisfied.
- Do not put reviewer credentials, Supabase service-role keys, or payment
  credentials in source control or this tracker.
