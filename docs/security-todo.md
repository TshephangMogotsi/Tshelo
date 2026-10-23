# Remaining security work

[Consolidated audit: original review, done and remaining](security-audit-against-original-review-2026-10-16.md).

Updated: 20 October 2026. This checklist records outstanding work from the
security remediation discussion; unchecked items are not yet verified complete.

20 October: Cloudflare country-waitlist setup and approved activation are complete.
The live browser submission, stored QA record and invalid-token rejection passed.
[Evidence](turnstile-waitlist-setup-2026-10-20.md).

Release checks on 16 October: database regressions, website build, mobile JS
exports and the complete verification chain passed after fixing both
phone/notification API-boundary failures. The patched website was promoted to
`tshelo-admin.vercel.app`. Explicitly approved synthetic authenticated live QA
passed receipt upload → provider parse → review → expense save, encrypted payment
reset/owner notice, and all three consent regressions. One completed receipt audit
and nine labeled synthetic consent records are retained. QA account banned,
sessions/refresh tokens removed, fund completed. `app.tshelo.com` still returns
404 for completion and needs its owner/correct target resolved. Native/device,
SMS/push and customer consent history remain unverified.
[Live QA evidence](live-qa-verification-2026-10-16.md).
[Deployment evidence](web-release-deployment-2026-10-16.md).
[Full release checks](release-checks-2026-10-16.md).

## Priority 1 — Public entry points and database defaults

### Country waitlist

- [x] Inventory `country_waitlist` grants, policies and current submission flows.
- [x] Close direct table submissions and implement a controlled server endpoint.
- [x] Validate supported country codes, contact formats and field lengths.
- [x] Normalize contacts and handle duplicates without exposing existing entries.
- [x] Add durable rate limits for IP/contact identity and server-validated CAPTCHA code.
- [x] Confirm the 12-month retention period and implement dedicated daily database cleanup.
- [x] Verify the cleanup job's first scheduled execution: 13 October at 04:15
      Botswana time; runs on 14, 15 and 16 October also succeeded.
- [x] Deploy 15-minute failure/overdue/configuration monitoring with private incidents,
      searchable warnings and a fail-closed operator health command. First scheduled
      monitor run passed on 16 October. [Evidence](waitlist-cleanup-monitoring.md).
- [ ] Connect an independent uptime/alert destination for out-of-band notification.
- [x] Test invalid input, repeated submissions, abuse limits and denied direct access.
- [x] Deploy and verify database permissions and server-only RPCs.
- [x] Connect the supplied Turnstile keys, hostname and server rate-limit secret;
      deploy the form/backend with collection disabled. Live widget displayed Success
      on 20 October. [Setup evidence](turnstile-waitlist-setup-2026-10-20.md).
- [x] Obtain explicit launch approval and verify one labeled synthetic submission
      through the live production widget/form and stored contact row on 20 October.
- [x] Enable collection after cleanup/notice checks and explicit approval; production
      missing/invalid-token requests were rejected and the positive live test passed.

### Default table privileges

- [x] Inspect live creator defaults.
- [x] Remove automatic future-table client grants for application migrations (`postgres`).
- [x] Close postgres future table/sequence/function defaults, including global PUBLIC function execution; applied and live-verified on 23 October. [Evidence](postgres-defaults-fix-2026-10-23.md).
- [ ] Authorized managed-role administrator/Supabase support: close the remaining supabase_admin future defaults and verify. [Handoff SQL](supabase-admin-defaults-handoff-2026-10-23.sql).
- [x] Require explicit grants and RLS policies for new application tables.
- [x] Add CI/deployment checks for missing RLS, structural grants and grants without policies.
- [x] Test a newly created table locally and in a rolled-back live transaction.

### Supabase leaked-password protection

- [x] Inspect the live Auth setting and project support for leaked-password protection.
- [x] Enable the protection where supported and verify the effective setting.
- [x] Test live password sign-up rejection and the returned error message; the current
      app has no password-reset/change UI to exercise.
- [x] Document applicability to Tshelo's phone/OTP and admin authentication flows.

Enabled and verified on 15 October 2026. The public Auth API rejected a synthetic
sign-up with HTTP 422, `weak_password`, reason `pwned`. Password-change/reset
completion and existing-user login were not exercised. Evidence and scope:
[leaked-password protection](leaked-password-protection-2026-10-15.md).

## Priority 2 — Membership authorization

- [x] Inventory organization and recurring-group membership policies and dependencies.
- [x] Replace recursive policies with narrowly scoped membership helpers.
- [x] Pin helper search paths and explicitly restrict function execution privileges.
- [x] Test owner/member access, pending and former members, anonymous access,
      cross-group isolation, and absence of recursive-policy errors.
- [x] Deploy migrations and verify helper permissions and table-security guard.
- [ ] Smoke-test organization/group UI when those currently unused features are implemented.

Phase 2 implementation and rollout details: [handoff](security-phase-two-2026-10-12.md).

### Fund membership and consent — live verification, 15 October

- [x] Verify joined/pending/left/unrelated access across the 13 assessed shared-data
      tables, plus vote/vouch/report inserts and the actual leave RPC.
- [x] Require joined membership for all vouch reads, including authors/recipients.
      Migration `20261015230000` applied; 18 relationship/status cases, cross-fund
      isolation and two actual leave-RPC cases passed live with rolled-back fixtures.
      [Evidence](vouch-read-fix-2026-10-15.md).
- [ ] Confirm the intended fund-row visibility for pending invitees.
- [x] Verify consent RPC audit creation, database timestamps, client-write denial
      and cross-user log isolation using rolled-back fixtures.
- [x] Record first-time explicit processing acceptance even for legacy true flags;
      new profiles default false, without backfilling historical acceptance.
- [x] Audit channel-only email/SMS/push marketing preference changes.
- [x] Make aggregate marketing withdrawal disable every channel, including when
      the same payload contains a conflicting channel opt-in.
- [x] Verify deployed consent API creation and all three regressions using approved
      synthetic live QA: nine labeled records retained.
- [ ] Verify released registration/preferences UI on a controlled device; synthetic
      API records do not establish customer consent history.

Evidence and reproducible script:
[membership/consent verification](membership-consent-verification-2026-10-15.md).
The three consent fixes were applied and regression-tested live on 15 October:
[migration and verification](consent-fixes-2026-10-15.md).

## Priority 3 — Admin access and financial identifiers

### Platform-admin MFA

Implementation is complete and all five disposable end-to-end scenarios passed
on 23 October 2026. Production rollout remains open; see the
[implementation and rollout record](platform-admin-mfa-2026-10-22.md).

- [x] Implement authenticator enrollment and challenge flows for platform administrators.
- [x] Require verified MFA assurance for admin pages, APIs and privileged database operations in the implementation.
- [x] Test all four admin roles, insufficient-assurance denial, existing role permissions and ordinary-user access in disposable Supabase.
- [ ] Inspect production admin sign-in methods, MFA settings and enrollment status.
- [ ] Arrange a confirmed Auth email address for every platform administrator, including phone-login accounts; Supabase TOTP enrollment requires one.
- [ ] Nono: nominate primary and backup recovery owners.
- [ ] Agree and document recovery approvals, re-enrollment, recovery credential custody and audited emergency access; test the procedure before enforcement.
- [ ] Coordinate production deployment of the enrollment UI and matching database enforcement migration.
- [ ] Enroll the nominated administrators and verify their authenticator challenges.
- [ ] Verify live denial of insufficient-assurance sessions, role permissions and ordinary-user access; obtain release sign-off.

Nothing has been deployed to production as part of this implementation.

### Bank and mobile-money account-number encryption

- [x] Inventory active application reads and writes: payment updates are routed through
      `update_own_payment_details`; the client profile response does not return identifiers.
- [x] Confirm no approved exact-match lookup needs either identifier; no correlation hash was added.
- [x] Select Supabase Vault for database-generated key management; document rotation and recovery.
- [x] Add randomized AES-256 encrypted storage for bank-account and mobile-money numbers.
- [x] Update server write/read boundaries: only payment routines can decrypt, and plaintext retrieval is service-role-only.
- [x] Apply the atomic ciphertext backfill/legacy-plaintext clearing migration to the linked project.
- [x] Verify controlled service-role decrypt samples, existing ciphertext decryption,
      and zero non-null legacy plaintext values (15 October).
- [x] Review current audit/export/notification paths and API error logging for identifiers;
      record backup exposure and recovery requirements in the encryption runbook.
- [x] Review accessible retained Supabase/Vercel/database telemetry for current payment
      identifiers: no matches; synthetic SQL fixture literals classified.
      [Evidence and coverage](payment-telemetry-review-2026-10-16.md).
- [ ] Complete inaccessible provider/drain-history checks and isolated backup recovery validation.
- [ ] Retire plaintext columns after validating compatibility and recovery procedures.
- [x] Verify a rotation round trip without changing the live key, browser-role denial,
      and payment RPC writes/resets/notifications in a rolled-back live transaction.
- [x] Deploy the follow-up revocation of inherited authenticated EXECUTE on the
      service retrieval function (`20261015210000`).
- [ ] Verify released web/mobile payment-detail flows end to end after the held release.

Implementation: [`payment-identifier-encryption.md`](payment-identifier-encryption.md).

## Provider/product-dependent work

### Mobile-money ownership verification

Dependency: select a provider/aggregator that can confirm account ownership and
obtain integration credentials and callback specifications.

- [ ] Agree the ownership-verification method with the provider.
- [ ] Build an authenticated endpoint with server-generated challenges, expiry,
      attempt limits and rate limiting.
- [ ] Authenticate provider callbacks and prevent replay or duplicate completion.
- [ ] Accept verification status only from trusted provider evidence.
- [ ] Add the user-facing flow and test expiry, failed attempts and forged approvals.
- [ ] Deploy and verify the provider integration end to end.

### Promo-code validation and redemption

Dependency: agree benefit types, eligibility, country restrictions, expiry,
per-user limits and campaign-wide limits.

- [ ] Review the full promo schema, including redemption/use records and permissions.
- [ ] Build an authenticated, rate-limited supplied-code validation endpoint.
- [ ] Return only the applicable benefit and necessary eligibility information.
- [ ] Implement atomic redemption and duplicate/replay protection.
- [ ] Test expired/ineligible codes, exhausted limits, concurrent redemption and enumeration resistance.
- [ ] Deploy and verify without restoring client promo-catalog access.

### Before enabling SMS processing

The SMS watcher is currently disabled. Client log access is closed and future raw
message/error text is discarded by a deployed database trigger.

- [ ] Define retention/expiry for structured financial and personal processing records.
- [ ] Validate structured fields so OTPs or credentials cannot enter reference/name fields.
- [ ] Review the future sender/parser and telemetry for sensitive-content logging.
- [ ] Review notification payloads and backup/provider-log handling.
- [ ] Add trusted server logging only when an active processing flow needs it.
- [ ] Add a minimal, authorized processing-history view only if a user flow requires it.

## CI/CD pipeline

- [x] Prepare combined app/security, database, website/API and MFA CI with one required readiness check.
- [x] Protect main and configure approval-protected, main-only release environments.
- [x] Prepare manual Vercel and EAS workflows; explicitly disable deployments with RELEASES_ENABLED=false.
- [x] Resolve the braces/node-forge blockers with reviewed pinned fixes, pass combined CI and merge [PR #2](https://github.com/TshephangMogotsi/Tshelo/pull/2) (23 October 2026).
- [ ] Replace temporary source pins/local fork with compatible official patched releases when available; retain exploit regression and source-integrity checks.
- [ ] Activate and rehearse deployments only when separately authorized; deployment credentials were not added.

Details and recovery procedure: [CI/CD pipeline](cicd-pipeline.md).

## Verification and release follow-up

- [x] Resolve existing mobile API-boundary test failures involving `lib/changePhone.ts`
      and `screens/main/NotificationSettingsScreen.tsx` without weakening the guardrails.
- [x] Run applicable verification and runtime dependency audits for the web release.
      Runtime audit clean; five high development-only ESLint findings remain.
- [ ] Verify committed changes independently of unrelated worktree changes.
- [ ] Push the local security commits when preparing the repository release:
      `e02e613`, `f902ea4` and `e2b826b`.
- [ ] Verify/release the web/API changes in `e02e613`, including account-deletion
      verification and receipt scan-completion routes; check required server secrets.
- [ ] Include the mobile receipt-review/audit integration in the next app build and smoke-test it.

Historical snapshot checked 15 October (superseded by the live QA/deployment
reports above): receipt database migration and audit-enabled
parser v8 are deployed; the audit table is empty. Production web/API is still on
`91421bb` and `/api/v1/receipts/scan-completion` returns 404. Latest recorded
production mobile builds also reference `91421bb`; no production OTA updates
exist. See [receipt deployment and cleanup evidence](receipt-and-waitlist-status-2026-10-15.md).

## Completed baseline

- [x] Audit service-role exposure in current client configuration, working-tree
      source/reachable Git history, local builds, latest production iOS/Android
      archives (including disassembled Hermes strings), and public bundles from
      three accessible web origins. No privileged keys found in these surfaces.
      [Evidence and coverage limits](service-role-exposure-audit-2026-10-15.md).
- [x] Item 1 database checks: 30 explicit protected assignments and all 53
      nonallowlisted-column updates denied; permitted own-profile edits,
      cross-user isolation, payment verification resets and owner notification
      creation verified live on 15 October with rolled-back fixtures.
      Full item closure still requires released app/web and ownership
      re-verification checks. [Evidence](protected-profile-verification-2026-10-15.md).
- [x] Client creation/modification of mobile-money verification records blocked.
      Reconfirmed live on 15 October: 11 client operations denied, owner-only
      reads and service-role writes verified, fixtures rolled back.
      [Item 2 update and evidence](mobile-money-verification-recheck-2026-10-15.md).
- [x] Client SMS-log writes and reads blocked.
- [x] Future SMS raw-body and free-text error retention prevented.
- [x] Live SMS table reviewed: empty at the time of review.
- [x] Client promo-code catalog access removed; live promo-code table reviewed: empty.
- [x] All 12 configuration rows and 20 templates reviewed and individually classified.
- [x] Configuration restricted to four approved version/maintenance keys for clients.
- [x] Notification-template catalog restricted to trusted servers.
- [x] Phase 1 migrations deployed; focused database tests and live permission checks passed.

Evidence: [Phase 1 handoff](security-phase-one-2026-10-12.md) and
[complete classification inventory](security-data-classification-2026-10-12.md).
