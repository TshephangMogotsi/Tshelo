# Phase 8 — Public-launch hardening and handoff

Status date: 12 August 2026

## Outcome

Phase 8 engineering hardening is complete. The current iOS Release build compiles, installs, launches, and reaches the signed-in Overview screen. The linked Supabase project is current through migration `20260812180000`.

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

## Required before public submission

### Product and client approval

- Obtain client approval or amendments for [Tshelo_Trust_Points_Client_Review_Draft.docx](../output/Tshelo_Trust_Points_Client_Review_Draft.docx).
- Confirm the token pack prices and paid-feature costs are final.
- Provide `EXPO_PUBLIC_TOKEN_PORTAL_URL`, or explicitly ship token checkout as unavailable. The current app clearly says checkout is coming soon and takes no payment.

### Legal and store policy

- Publish the final Terms of Service and Privacy Policy on public HTTPS pages.
- Wire the registration consent links and Settings rows to those verified pages. They are currently display-only/inert.
- Complete Apple and Google privacy/data-safety questionnaires, age rating, support URL, screenshots, and store descriptions.
- Confirm that SMS access remains an Android-only core feature and prepare the Play Console permission declaration for `RECEIVE_SMS`.

### Signed distribution builds

- Install JDK 17 or repair `JAVA_HOME` before producing the Android AAB. The current configured path, `/Applications/Android Studio.app/Contents/jbr/Contents/Home`, does not exist on this machine.
- Run an Android native Release/AAB build after the JDK is available. The Android application bundle was not produced in Phase 8; only its production JS/Hermes bundle was verified.
- Verify Apple distribution certificates/profiles and Google Play signing credentials in EAS.
- Run signed production builds with the `production` EAS profile, then test each artifact on a physical device before submission.

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

Public store submission: **not yet ready** until the legal links are live, the Android JDK/AAB gate passes, store credentials and metadata are verified, and the client approves the trust-points/reward draft.
