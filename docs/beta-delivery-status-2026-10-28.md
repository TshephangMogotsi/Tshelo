# Beta delivery review — 28 October 2026

Working record of the client's overdue items. User confirmations and repository
evidence are distinguished from live release/device verification.

## 1. Android tester startup crash — outstanding

The developer confirms the affected tester still experiences a crash before the
app opens. The cause has not been identified. Next: inspect Play Console crash
reports; if absent, obtain an Android bug report or capture Logcat while the
tester reproduces the failure. Record phone model, Android version, installed
app version/build and reproduction time. Keep device reports private.

No installed native crash-reporting SDK was found during repository inspection.
Potential follow-up: add native/JavaScript crash reporting and automatic device
and build details to feedback submissions. This is recorded work, not an
implemented change; native integration requires a new build.

Closure requires a fix if needed and successful retest on the affected phone.

## 2. Website-only registration and login — under review

Client intent: a new person can register and use the website without installing
the mobile app, and can subsequently sign in again.

The developer confirmed approved testers must be able to register directly
without an invitation. The approved tester list is an Excel file containing
email addresses. The direct email registration flow is deployed on
`tshelo-admin.vercel.app` as Vercel deployment
`dpl_9BeZGiGaWt3M3GgFjZ62tMmqBLhD`, including the registration, login selector,
and web onboarding changes. Database migration
`20261028120000` was applied and recorded.
The route is closed by default and the production endpoint returned 403 on a
closed-gate check. The client requested that tester access remain on hold until
their admin-access and MFA verification is complete. The supplied Excel list
contains 17 distinct valid email addresses; it was added as a sensitive
production configuration value on 28 October and included in the current
deployment. The registration-enable setting remains absent.

Web onboarding now collects profile and consent, optional primary bank details,
ownership confirmation and final completion. Additional mobile-money numbers
are not accepted without verification. Focused UI checks passed; the full live
registration and payment-details flow remains untested under the access hold.

After the client lifts the hold: enable the registration gate and redeploy,
confirm Supabase's email template delivers OTP codes, and
test registration with a controlled approved account. Do not record codes or
the private tester list here.

Live registration, email delivery, onboarding, account use, sign-out and repeat
login have not yet been verified. Item remains open.

## 3. Beta testing lists — done, developer confirmed

Developer confirms all beta testers have been added. A dated list/export can
serve as audit evidence; no independent reconciliation performed in this review.

## 4. Static OTP — configured for some testers, developer confirmed

Supabase static OTPs were configured for some testers because some regions are
not yet verified with Twilio. Confirm coverage and successful login for every
tester needing the workaround. Regional SMS verification remains outstanding.

## Remaining items

5. Feedback form: source implementation exists; distributed-app submission and
support-queue receipt need verification.
6. Feature update: verify each requested feature against the exact tester build.
7. App/web sign-in recovery: the current local implementation adds native email
   sign-in and website recovery settings. Its server endpoint verifies a code
   for the existing confirmed contact, then verifies the replacement contact;
   email recovery uses a separately delivered code and a restricted Auth admin
   update rather than requiring the inaccessible old email. Private, expiring
   challenges and account-level rate limits are in migration `20261028150000`;
   confirmed email changes sync to the profile via `20261028140000`. Platform
   admins and accounts with verified MFA factors are excluded and follow the
   separate approved recovery procedure. Static
   test-phone OTPs must be audited and blocked before enabling email recovery.
   Both migrations and native changes are local only. The web endpoint and UI
   were staged on 28 October as Vercel deployment `dpl_5NZzNhCPREDfAbriNTU1B3on9GSk`,
   without promoting the production domain; its disabled endpoint returned 503.
   The `TSHELO_RECOVERY_ENABLED` flag defaults to disabled. On 28 October the
   developer selected the existing Tshelo Resend account; its existing local
   credential, the existing application sender address and a generated challenge
   secret were stored as sensitive production environment settings. An attempt
   to inspect verified sender domains returned HTTP 401 and did not establish
   whether that credential and sender can deliver; existing deployments predate
   the settings. Other activation prerequisites remain; see `admin/README.md`.
   Further tests
   were initially skipped at the developer's request. On 28 October, focused
   checks passed for app/web types, verified-source rejection, static OTP and
   MFA exclusions, challenge account binding, attempt limits and single use.
   These checks use mocks or disposable PGlite; real provider behavior and
   end-to-end recovery have not been verified. No Tshelo non-production Supabase
   project or local Docker was available.
8. Web parity: obtain exact 7 October feature scope and verify deployed behavior.
9. Admin MFA: implementation/disposable test evidence exists; production rollout,
enrollment and approved/rehearsed recovery remain unverified.
10. REG-009: Codex account confirmed as Digital Natives; finalize tool/account/data
disclosure and record it in the register.
11. Hosting renewal: billing/domain renewal evidence needed from account owner.
12. Release date: agree candidate, verification owners/results and distribution
approval before committing a date.
