# Phase 8 — Public-launch hardening and handoff

Status date: 11 September 2026

Update — 10 September 2026: the public Terms and Privacy pages are live, and
registration/Settings links are configured. Native event banners, low-data
images, timezone-aware schedules, pinned updates and enhanced RSVP are
implemented locally; the linked database is current through
`20260909140000_event_banner_focal_points.sql`. Signed physical-device testing,
distribution artifacts and store-console actions remain.

Update — 11 September 2026: the initial version-code 2/3 artifacts from commit
`4e03ef8` were superseded before distribution after physical-flow review found
that OTP completion could race the root navigator and skip the remaining
registration screens. Do not distribute EAS builds
`90013fa8-8de7-4663-aa79-081b4b520eeb` or
`3635f749-85d0-46da-ab41-ecf45bed81b5`.

Commit `4e8db56` keeps registration incomplete after OTP, persists confirmed
payment details, and marks the profile complete only from the final success
screen. The full verification suite passes with a three-case registration-flow
regression. Expo EAS produced these approved replacements with the same managed
keystore:

- Production Play AAB, version code 4: EAS build
  `3b9e29a9-9da3-48ff-91d4-c78df40d6ddf`, 73,663,461 bytes, SHA-256
  `aa8090673ed5bb0beded78eccd18c2ebee1868039470981b60cce2736b9631db`.
- Internal-distribution APK, version code 5: EAS build
  `d669632d-41d5-4d81-86f8-77486c8dce8a`, 110,027,608 bytes, SHA-256
  `3d841cff78a09a50555fcc75f8cfa5476731d0a12c2af8f212fbfcbf3cb2d764`.

Both downloaded archives passed integrity checks. The AAB contains its signing
manifest/certificate records. Physical-device installation and the user-owned
device smoke checklist remain pending; no simulator was used.

## Outcome

Phase 8 engineering hardening is complete. The current iOS Release build compiles,
installs, launches, and reaches the signed-in Overview screen. The linked Supabase
project is current through migration
`20260909140000_event_banner_focal_points.sql`.

External release actions and the product/legal decisions listed below must be completed before public store submission. No App Store or Play Store submission was made in this phase.

## Completed engineering gates

- Removed the internal “100 test tokens” claim flow from the mobile client.
- Revoked `PUBLIC`, `anon`, and `authenticated` access to `claim_beta_test_tokens()` in the linked production database.
- Preserved historical beta grant and token-ledger records for audit.
- Added explicit startup validation for the required public Supabase URL and anonymous key.
- Added regression coverage for retired beta access and missing runtime configuration.
- Applied npm's non-breaking transitive dependency fixes; no forced framework upgrade was used.
- Passed TypeScript and the full Jest suite: 20 suites and 163 tests.
- Built the iOS simulator Release configuration successfully and generated the production Hermes bundle.
- Installed and launched the iOS Release build successfully on an iPhone 17 simulator.
- Exported the Android production JavaScript/Hermes bundle successfully: 1,296 modules and 54 assets.
- Confirmed all local and linked Supabase migrations match through
  `20260909140000_event_banner_focal_points.sql`.
- Published the Terms of Service and Privacy Policy on public HTTPS pages and
  wired the registration consent and Settings links to them.

## Required before public submission

### Product and client approval

- Obtain client approval or amendments for [Tshelo_Trust_Points_Client_Review_Draft.docx](../output/Tshelo_Trust_Points_Client_Review_Draft.docx).
- Confirm the token pack prices and paid-feature costs are final.
- Provide the production `EXPO_PUBLIC_API_BASE_URL` before migrating mobile screens to API v1.
- Provide `EXPO_PUBLIC_TOKEN_PORTAL_URL`, or explicitly ship token checkout as unavailable. The current app clearly says checkout is coming soon and takes no payment.

### Legal and store policy

- Complete Apple and Google privacy/data-safety questionnaires, age rating, support URL, screenshots, and store descriptions.
- Confirm that SMS access remains an Android-only core feature and prepare the Play Console permission declaration for `RECEIVE_SMS`.

### Signed distribution builds

- [x] Produce a signed Android production AAB with the EAS production profile.
- [x] Produce a signed internal-distribution APK for direct Android device smoke testing.
- Install JDK 17/Android platform tools only if local USB builds or ADB installation
  are required. Cloud EAS signing does not depend on the missing local toolchain.
- Verify Apple distribution certificates/profiles and Google Play submission
  credentials in EAS/Play Console.
- Install the signed APK on a physical Android device and complete the beta smoke
  checklist before uploading the AAB to the Play internal-testing track.
- Produce and physically test the signed iOS distribution artifact before its
  submission.

## Dependency advisory review

The current advisory database still reports transitive findings in the Expo 54/Metro build toolchain:

- `image-size`: no patched version is available through the current Metro dependency tree.
- `postcss` and `uuid`: npm proposes a forced Expo 57 upgrade, which is a breaking framework change and was intentionally not applied to this release candidate.

These packages are reached through build/configuration tooling rather than Tshelo's payment or Supabase authorization code. They should remain on the framework-upgrade backlog and be re-audited when moving to the next supported Expo SDK. Do not use `npm audit fix --force` on the release branch without a dedicated upgrade and native regression cycle.

## Repeatable release checks

Run these from the repository root before generating any signed artifact:

```sh
npm ci
npm run verify
supabase migration list --linked
npx expo export --platform android --output-dir /tmp/tshelo-android-export --clear
```

For native artifacts, also run the appropriate signed EAS production build and complete physical-device smoke testing for authentication, joining, contribution recording, expenses, reports/PDF export, notifications, leaving funds/events, granular admin permissions, and token balance errors.

## Release decision

Engineering release candidate: **ready for final stakeholder and account-owner actions**.

Public store submission: **not yet ready** until store credentials and metadata
are verified, physical-device testing is complete, and the client approves the
trust-points/reward draft. The Android signed-artifact gate is complete.
