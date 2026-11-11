# Tshelo security audit against the 5 October review

Status as of 16 October 2026, based on the recorded database checks, deployed changes and approved synthetic live API tests. This report distinguishes completed fixes from remaining engineering work and work requiring client, account-owner or administrator setup. It does not represent a fresh penetration test or a rerun of every historical check.

## Completed work

The direct profile-editing vulnerability in item 1 has been fixed. Normal users can update only the approved profile and preference fields. They cannot directly change verification flags, bans, account locks, balances, trust values, consent timestamps or payment details. Live tests rejected 30 explicit protected-field assignments and attempts against all 53 columns outside the allowlist. The ten permitted profile and preference edits worked, and cross-user edits failed. This closes the direct-write exposure, although the additional payment re-verification flow remains outstanding. The detailed results are in the [protected-profile verification](protected-profile-verification-2026-10-15.md).

Bank and mobile-money changes now pass through controlled database routines. Changes reset the relevant verification flags and timestamps and create an owner notification without including the account number. Unchanged details do not create duplicate notices. Bank and mobile-money numbers are encrypted, legacy plaintext columns are constrained to remain empty, and ordinary clients cannot decrypt the stored values. These controls passed database tests and the approved live API run. The notification checks prove creation of the owner notice; device delivery still needs testing. See the [encryption record](payment-identifier-encryption.md) and [live API evidence](live-qa-verification-2026-10-16.md).

Item 2 is complete. The `mmv_insert` policy has been removed, and clients cannot create, update or delete mobile-money verification records or forge their status and evidence fields. Backend writes remain available, and users can read only their own records. Eleven client operations were rejected during live testing. The reviewed application code and public database functions do not trust client-authored verification status. The [item 2 reconfirmation](mobile-money-verification-recheck-2026-10-15.md) contains the completed-fix update and test results.

The membership permission fixes in item 3 are complete. Succession votes and vouches require joined membership, and `is_fund_member` checks joined status. Joined-only access applies to all the listed contribution, expense, announcement, export, milestone, ownership-history, sharing, succession, sponsorship and vouch tables, together with fund-report inserts. Pending, former and unrelated users were tested. Vouch reads were also tightened so that authors and recipients lose access after leaving. The [membership checks](membership-consent-verification-2026-10-15.md) and [vouch follow-up](vouch-read-fix-2026-10-15.md) record the results.

The smaller database exposures have also been addressed. Anonymous and signed-in users cannot enumerate the promo-code catalogue. Clients cannot write to or read the SMS log, and controls prevent future raw-message and free-text error retention. The recursive organization and recurring-group policies were replaced and tested without recursion. Configuration and notification templates were reviewed: clients can read only four approved version and maintenance settings, while templates are server-only. These changes are documented in the [phase-one review](security-phase-one-2026-10-12.md), [phase-two review](security-phase-two-2026-10-12.md) and [configuration inventory](security-data-classification-2026-10-12.md).

Unrestricted waitlist table access has been removed. A controlled submission flow implements validation, normalization, duplicate handling, rate limits and server-validated CAPTCHA checks. Daily cleanup succeeded on 13, 14, 15 and 16 October. A separate monitor now checks every 15 minutes for failures, overdue runs and configuration problems, records private incidents and emits searchable warnings. Its first scheduled execution and operator health check passed, along with 13 live regression scenarios. Public collection and external alert delivery still require setup. See the [cleanup monitoring record](waitlist-cleanup-monitoring.md).

Receipt logging is implemented and verified through the promoted web API. The synthetic live test used the actual receipt provider, saved the model and version, recorded the result and reviewed edits, completed the audit record and created an expense. Consent recording is also fixed: initial processing acceptance, channel-only marketing changes and complete marketing withdrawal all passed. Nine clearly labeled synthetic consent records were retained as approved. These establish working API recording, not historical customer consent or released-device behaviour. The [consent fixes](consent-fixes-2026-10-15.md) and [live QA report](live-qa-verification-2026-10-16.md) contain the evidence.

Leaked-password protection has been enabled and tested. A live signup using a compromised password was rejected with `weak_password` and the reason `pwned`. This closes the requested setting change; it does not replace administrator MFA. The [password-protection report](leaked-password-protection-2026-10-15.md) records the setting and test.

Future-table defaults have been hardened for the application migration creator, `postgres`. New tables require explicit grants, RLS and policies wherever client access is granted, and automated checks detect missing controls. The reviewed migrations are recorded remotely, including encryption, consent, vouch access and cleanup monitoring. SQL changes are kept in `supabase/migrations/`, with regression tests in `supabase/tests/` and `security/fixtures/`. The separate managed-role default issue remains open.

The service-role audit found no privileged keys in the inspected client configuration, source history, builds, production mobile archives or accessible website bundles. Current service-role usage is confined to server routes, Edge Functions and operator tooling. This is a scoped finding and cannot certify every historical or inaccessible runtime surface. The [key-exposure audit](service-role-exposure-audit-2026-10-15.md) describes its coverage.

The payment telemetry review found no current payment identifiers across 1,640 Supabase events, 17 Vercel request records and 200 database history records. Number-looking SQL literals were traced to synthetic regression fixtures. Vercel returned no application messages, and Supabase denied access to its log-drain configuration, so historical exposure clearance remains limited. See the [telemetry review](payment-telemetry-review-2026-10-16.md).

The fund-leaving question is answered: leaving retains the `fund_members` row and changes its status to `left`. Joined-member access is revoked immediately, including the corrected vouch reads.

## Remaining engineering work

Payment changes still need a fresh authentication challenge. The existing session can submit changed details, although it cannot mark them verified. Engineering can begin the re-authentication flow now; completing ownership verification also depends on the provider setup described below.

Platform-admin MFA remains unimplemented. Engineering still needs to build enrollment and challenge flows, enforce the required assurance on privileged routes and operations, and implement recovery and re-enrollment. Existing OTP login does not close this requirement. Administrator participation is needed to finish enrollment and rollout testing.

Released registration, preferences, payment changes and receipt review still need end-to-end UI and device checks. Actual SMS or push delivery has not been verified. The requested staging test also remains outstanding: the existing evidence comes from rolled-back production fixtures and the explicitly approved synthetic production run. Password-change and reset completion have not been exercised. Historical customer consent must not be invented or backdated to fill missing audit history.

The remaining reviewed vouch, release and monitoring changes and their evidence need a scoped commit and push. Encryption and consent changes are already committed and recorded as pushed. The promoted website was deployed from an isolated base plus a saved release patch, rather than a new Git commit. Its source and deployment details are recorded in the [deployment report](web-release-deployment-2026-10-16.md). Unrelated local work must be excluded from the security commit.

## Work requiring client, account-owner or administrator setup

The domain or Vercel owner needs to identify the project serving `app.tshelo.com`, or confirm the approved replacement target. That hostname still returns 404 for receipt completion, while the fixed endpoint works on `tshelo-admin.vercel.app`. Resolving this is necessary before completing the mobile release path. A controlled QA device and disposable account also need to be set up for released-device testing; the retained synthetic API account has been disabled.

The client and payment provider need to agree how bank and mobile-money ownership will be verified and provide the necessary integration credentials and callback specifications. Engineering can build the surrounding authentication flow, but cannot complete provider-backed verification without that setup.

A managed-role administrator or Supabase support needs to remove the remaining automatic client grants in `supabase_admin` table defaults before the requested 30 October deadline. The dashboard Administrator access already granted has not provided the database-role privileges needed for this change.

Platform administrators need to participate in MFA enrollment and testing, and agree who owns recovery and emergency access. This is required alongside the engineering implementation, rather than being a substitute for it.

Public waitlist collection needs a production Turnstile widget for the correct hostname, server secrets and an agreed collection notice. Engineering must then complete the public submission test before enabling collection. An operator also needs to provide an approved external monitoring service and alert destination if email, paging or database-outage notifications are required. The deployed database monitor currently records incidents and warnings only.

Completing encryption assurance requires authorized access to an isolated backup recovery environment and the remaining provider or historical telemetry surfaces. Supabase analytics-configuration read access is needed to inspect log drains. Older backups may still contain plaintext, and no backup restore or actual encryption-key rotation has been performed.

The client should confirm which fund-preview fields pending invitees may see. They can currently read the fund row, but cannot read the joined-only shared tables. Pending and former members can also read their own membership status. Organization and recurring-group UI flows should be smoke-tested when those currently unused features are implemented. Promo campaign rules and SMS provider setup are needed only if those features are introduced or enabled.

Full security and release sign-off remains open for the engineering work and setup dependencies above. Completed database fixes remain supported by their individual test records.


## Follow-up on 20 October 2026

Cloudflare setup and public waitlist activation are now complete for
`tshelo-admin.vercel.app/waitlist`. After explicit approval, the reviewed source
was redeployed with collection enabled. The real browser flow accepted one
labeled synthetic Kenya/email entry; the database confirmed a single row with
no phone and the correct 12-month expiry. Missing and invalid CAPTCHA tokens
were rejected. The supplied keys, hostname and rate-limit configuration work;
no further Cloudflare setup from the colleague is needed for this hostname.
External alert delivery and the unrelated release dependencies above remain
open. [Implementation and evidence](turnstile-waitlist-setup-2026-10-20.md).
