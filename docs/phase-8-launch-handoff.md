# Phase 8 — Public-launch hardening and handoff

Status date: 10 September 2026

Update — 10 September 2026: the public Terms and Privacy pages are live, and
registration/Settings links are configured. Native event banners, low-data
images, timezone-aware schedules, pinned updates and enhanced RSVP are
implemented locally; the linked database is current through
`20260909140000_event_banner_focal_points.sql`. Signed physical-device testing,
distribution artifacts and store-console actions remain.

Update — 11 September 2026: Expo EAS successfully produced both Android beta
artifacts from commit `4e03ef8` with the same project fingerprint
`1bcb8f652015f16455caebfa94d4219db07a9d7a` and Expo-managed keystore:

- Production Play AAB, version code 2: EAS build
  `90013fa8-8de7-4663-aa79-081b4b520eeb`, 73,663,018 bytes, SHA-256
  `8fd097ca4efa8e93609bdb923edde6d35f9237ebe06710f1b11653a557baa9a6`.
- Internal-distribution APK, version code 3: EAS build
  `3635f749-85d0-46da-ab41-ecf45bed81b5`, 110,026,756 bytes, SHA-256
  `ff8ae509d17184f7cedb0d588d6be07e2db718fab005539481bbf9e77749cc1d`.

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
- Confirmed all local and linked Supabase migrations match through `20260812180000`.
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
