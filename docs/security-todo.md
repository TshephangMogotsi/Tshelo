# Remaining security work

Updated: 12 October 2026. This checklist records outstanding work from the
security remediation discussion; unchecked items are not yet verified complete.

## Priority 1 — Public entry points and database defaults

### Country waitlist

- [x] Inventory `country_waitlist` grants, policies and current submission flows.
- [x] Close direct table submissions and implement a controlled server endpoint.
- [x] Validate supported country codes, contact formats and field lengths.
- [x] Normalize contacts and handle duplicates without exposing existing entries.
- [x] Add durable rate limits for IP/contact identity and server-validated CAPTCHA code.
- [x] Confirm the 12-month retention period and implement dedicated daily database cleanup.
- [ ] Verify the cleanup job's first scheduled execution and monitor subsequent failures.
- [x] Test invalid input, repeated submissions, abuse limits and denied direct access.
- [x] Deploy and verify database permissions and server-only RPCs.
- [ ] Configure Turnstile/secrets, deploy web routes and test real public submissions.
- [ ] Enable collection only after the cleanup schedule and collection notice are ready.

### Default table privileges

- [x] Inspect live creator defaults.
- [x] Remove automatic future-table client grants for application migrations (`postgres`).
- [ ] Obtain elevated platform access to remove `supabase_admin` public-table client defaults.
- [x] Require explicit grants and RLS policies for new application tables.
- [x] Add CI/deployment checks for missing RLS, structural grants and grants without policies.
- [x] Test a newly created table locally and in a rolled-back live transaction.

### Supabase leaked-password protection

- [ ] Inspect the live Auth setting and project support for leaked-password protection.
- [ ] Enable the protection where supported and verify the effective setting.
- [ ] Test relevant password sign-up/reset flows and understandable rejection messages.
- [ ] Document applicability to Tshelo's phone/OTP and admin authentication flows.

## Priority 2 — Membership authorization

- [x] Inventory organization and recurring-group membership policies and dependencies.
- [x] Replace recursive policies with narrowly scoped membership helpers.
- [x] Pin helper search paths and explicitly restrict function execution privileges.
- [x] Test owner/member access, pending and former members, anonymous access,
      cross-group isolation, and absence of recursive-policy errors.
- [x] Deploy migrations and verify helper permissions and table-security guard.
- [ ] Smoke-test organization/group UI when those currently unused features are implemented.

Phase 2 implementation and rollout details: [handoff](security-phase-two-2026-10-12.md).

## Priority 3 — Admin access and financial identifiers

### Platform-admin MFA

- [ ] Inspect current admin sign-in methods, MFA settings and enrollment status.
- [ ] Implement enrollment and challenge flows for platform administrators.
- [ ] Require verified MFA assurance for admin routes and privileged database operations.
- [ ] Define recovery, re-enrollment and audited emergency access before enforcement.
- [ ] Enroll administrators and test denial of unenrolled or insufficient-assurance sessions.
- [ ] Roll out enforcement and verify live privileged access.

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
- [ ] Complete historical provider/telemetry-log review and isolated backup recovery validation.
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

## Verification and release follow-up

- [ ] Resolve existing mobile API-boundary test failures involving `lib/changePhone.ts`
      and `screens/main/NotificationSettingsScreen.tsx` without weakening the guardrails.
- [ ] Run the complete applicable verification suite and dependency audits before release.
- [ ] Verify committed changes independently of unrelated worktree changes.
- [ ] Push the local security commits when preparing the repository release:
      `e02e613`, `f902ea4` and `e2b826b`.
- [ ] Verify/release the web/API changes in `e02e613`, including account-deletion
      verification and receipt scan-completion routes; check required server secrets.
- [ ] Include the mobile receipt-review/audit integration in the next app build and smoke-test it.

## Completed baseline

- [x] Client creation/modification of mobile-money verification records blocked.
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
