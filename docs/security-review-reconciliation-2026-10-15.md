# Original security review — reconciliation, 15 October 2026

Current consolidated status: [16 October audit against the original review](security-audit-against-original-review-2026-10-16.md).

This maps the original six-part review and two questions to the work completed
and evidence collected in this session. Database fixes are distinguished from
unreleased application integrations. No release was triggered by this review.

**16 October release recheck:** database regressions and candidate website/mobile
JS builds passed. Both phone/notification API-boundary failures were fixed and
full verification passed. The receipt-integrated web build was promoted to
`tshelo-admin.vercel.app`. After explicit approval, synthetic authenticated live
QA passed receipt upload/provider parse/review/expense save, encrypted payment
reset/owner notice and all three consent regressions. One completed receipt audit
and nine labeled synthetic consent entries are retained; the QA account is banned,
sessions removed and fund completed. `app.tshelo.com` still returns 404 for receipt
completion and requires its owner/correct target. Device/SMS/push and customer
consent history remain unverified. See [live QA evidence](live-qa-verification-2026-10-16.md)
and [deployment record](web-release-deployment-2026-10-16.md).

| Original issue | Verified work | Remaining before full closure |
| --- | --- | --- |
| **1. Protected profile fields** | Normal authenticated role denied 30 explicit protected assignments and every one of the 53 nonallowlisted columns. Ten permitted profile/preference fields worked. Cross-user edits failed. Bank-only/mobile-only/combined changes reset verification and created owner notices; no-op updates did not duplicate notices. | Ownership re-verification/fresh-auth flow, held app/web rollout and end-to-end/device notification checks. Tests used rolled-back production fixtures, not staging. |
| **2. Client-created mobile-money verification records** | Closed. Migration recorded; no client write grants or write policies. Eleven client operations denied live; backend writes and owner-only reads worked. No current source/public-function consumer trusts client-authored verification status. | Provider-backed ownership verification is a separate unimplemented feature, not a reopened client-write permission. |
| **3. Vote/vouch insert membership** | Joined users could insert votes/vouches/reports; pending/left/unrelated users could not. `is_fund_member` requires joined status. | None found for these tested INSERT checks. |
| **3. Joined-only fund-data reads** | Joined users could read the 13 assessed shared-data tables; pending/left/unrelated users could not. Actual leave RPC immediately revoked shared access. The personal-vouch exception is now removed by `20261015230000`: 18 relationship/status cases and author/recipient leave tests passed live. | Pending users can still read the fund row; confirm intended invite-preview scope. |
| **4. Promo-code enumeration** | Fixed. Fresh live checks confirm no anonymous or authenticated catalogue SELECT/write access. | Product rules/backend redemption flow only if promo functionality is introduced. |
| **4. SMS client logging** | Fixed. Fresh live checks confirm no client SELECT/INSERT/UPDATE; prior deployed minimization trigger prevents raw-message/free-text-error storage. | Retention/parser/telemetry work before enabling the currently disabled SMS feature. |
| **4. Unrestricted country waitlist inserts** | Fixed database exposure: no direct client reads/writes. Controlled validated/rate-limited server flow exists. Cleanup ran successfully on 13/14/15/16 October at 04:15 Botswana time; zero recorded failures. | Keep public collection disabled until Turnstile/secrets, web deployment, notice and live submission test are ready. Scheduled database failure/overdue monitoring is now live, with first cron run and operator check passing. External alert delivery remains unconfigured. |
| **4. Recursive organization/group policies** | Deployed replacement helpers/policies; phase-two tests cover active/joined/pending/former/anonymous/cross-group access without recursion. Migration recorded remotely. | UI smoke tests when these currently unused features are implemented. |
| **4. Config/template sensitivity** | All 12 config rows and 20 templates were classified on 12 October; no credentials found in that snapshot. Fresh live checks confirm only four version/maintenance config keys are client-readable and templates are server-only. | Review new keys/templates as they are added. |
| **5. Platform-admin MFA** | Not implemented/enforced as part of this session. Current admin sign-in uses OTP. | Enrollment, challenge/enforcement, recovery and administrator enrollment/live tests. OTP login alone does not close MFA. |
| **5. Payment-number encryption** | Deployed and verified: six encrypted profiles, zero legacy plaintext values. Service decrypt tests, randomized encryption, role denials and rotation rehearsal passed. Extra authenticated service-function EXECUTE grant revoked live. Committed as `69f8523`. | App/web end-to-end release tests, inaccessible provider/drain history and isolated backup recovery test. Accessible retained telemetry was checked on 16 October without current-identifier matches; Vercel application-message coverage is absent. Older backups can contain plaintext. Legacy columns remain present but constrained NULL. No actual key rotation was performed. |
| **5. Log each receipt scan** | Audit table/routines and matching audit-enabled parser v8 are deployed. | Approved live QA now proves provider scan → edit → save with populated model/version/result/edits audit on the promoted web build. Resolve `app.tshelo.com` and verify the released mobile/device flow; no OTA/store release performed. |
| **5. Empty consent log** | Consent RPC creation/access controls verified. Three discovered defects fixed and deployed by `20261015220000`: explicit initial processing acceptance, channel-level history and complete marketing withdrawal. New profiles default false. Local and live strict regressions passed. | Nine labeled synthetic audit entries now verify deployed API acceptance/channel changes/withdrawal. Verify released registration/preferences UI and customer consent recording; no historical consent backfill performed. |
| **5. Leaked-password protection** | Enabled and saved in the live Email provider settings. Reopened and confirmed on. Public signup with a compromised test password returned HTTP 422, `weak_password`, reason `pwned`. | Password-reset completion was not exercised; current normal mobile/admin sign-in uses OTP. |
| **6. Future public-table defaults** | Application creator (`postgres`) global/public defaults hardened; explicit grants/RLS/policy guard and CI checks added. Rolled-back new-table test passed. | Fresh live inspection still shows client grants in `supabase_admin` public-table defaults. Requires an authorized managed-role/platform administrator or Supabase support action before marking fully closed. |
| **6. SQL/migration history** | Changes exist under `supabase/migrations`; the reviewed remediation migrations are recorded remotely, including encryption, consent and the joined-only vouch fix. Encryption is committed as `69f8523`; consent/evidence as `40423f4`, both pushed. | The new vouch migration/tests/evidence still need committing and pushing. The isolated web patch was deployed; local release/vouch changes and evidence still need a scoped commit/push. Unrelated work remains separate. |

## The two questions

**Where is service_role used?** Source review found server-only API routes for
account closure/waitlist work, Edge Functions and an operator provisioning script.
Normal mobile/browser clients use public keys. The subsequent exposure audit
found no privileged keys in inspected local configuration, working-tree source,
reachable Git history, local builds, latest production iOS/Android archives or
public root/login bundles from three accessible web origins. Hermes bundles
were also disassembled and scanned with synthetic positive controls. Historical
releases, authenticated/runtime surfaces and private deployment environment
values are not exhaustively covered, so “never reached any bundle” remains an
unqualified claim we cannot certify. See the [audit scope and evidence](service-role-exposure-audit-2026-10-15.md).

**What happens when someone leaves?** The actual `leave_fund` live fixture test
retained the `fund_members` row and changed its status to `left`; it did not delete
the row. Joined-member authorization became false immediately.

## Evidence

- [Protected profiles](protected-profile-verification-2026-10-15.md)
- [Mobile-money verification](mobile-money-verification-recheck-2026-10-15.md)
- [Membership and before-fix consent observations](membership-consent-verification-2026-10-15.md)
- [Joined-only vouch read fix](vouch-read-fix-2026-10-15.md)
- [Deployed consent fixes](consent-fixes-2026-10-15.md)
- [Encryption and recovery limits](payment-identifier-encryption.md)
- [Receipt deployment/builds and cleanup runs](receipt-and-waitlist-status-2026-10-15.md)
- [Leaked-password protection](leaked-password-protection-2026-10-15.md)
- [Service-role client/build exposure audit](service-role-exposure-audit-2026-10-15.md)
- [Phase-one rollout](security-phase-one-2026-10-12.md), [phase-two rollout](security-phase-two-2026-10-12.md), [config/template inventory](security-data-classification-2026-10-12.md)

The 15 October pre-release reconciliation confirmed zero plaintext account-number rows, zero
receipt/consent audit rows, closed mobile-money client writes, false processing
default, three successful cleanup runs, restricted config/template/SMS/waitlist
client access, and the outstanding managed-role defaults. The personal-vouch
exception was subsequently closed with the linked policy fix and live tests.

16 October follow-up: [waitlist monitoring](waitlist-cleanup-monitoring.md) and
[payment telemetry scope/evidence](payment-telemetry-review-2026-10-16.md).
