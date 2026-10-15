# Original security review — reconciliation, 15 October 2026

This maps the original six-part review and two questions to the work completed
and evidence collected in this session. Database fixes are distinguished from
unreleased application integrations. No release was triggered by this review.

| Original issue | Verified work | Remaining before full closure |
| --- | --- | --- |
| **1. Protected profile fields** | Normal authenticated role denied 30 explicit protected assignments and every one of the 53 nonallowlisted columns. Ten permitted profile/preference fields worked. Cross-user edits failed. Bank-only/mobile-only/combined changes reset verification and created owner notices; no-op updates did not duplicate notices. | Ownership re-verification/fresh-auth flow, held app/web rollout and end-to-end/device notification checks. Tests used rolled-back production fixtures, not staging. |
| **2. Client-created mobile-money verification records** | Closed. Migration recorded; no client write grants or write policies. Eleven client operations denied live; backend writes and owner-only reads worked. No current source/public-function consumer trusts client-authored verification status. | Provider-backed ownership verification is a separate unimplemented feature, not a reopened client-write permission. |
| **3. Vote/vouch insert membership** | Joined users could insert votes/vouches/reports; pending/left/unrelated users could not. `is_fund_member` requires joined status. | None found for these tested INSERT checks. |
| **3. Joined-only fund-data reads** | Joined users could read the 13 assessed shared-data tables; pending/left/unrelated users could not. Actual leave RPC immediately revoked shared access. | Personal vouches remain readable by their author/recipient after leaving, an exception to literal joined-only vouch reads. Pending users can also read the fund row; confirm intended invite-preview scope. |
| **4. Promo-code enumeration** | Fixed. Fresh live checks confirm no anonymous or authenticated catalogue SELECT/write access. | Product rules/backend redemption flow only if promo functionality is introduced. |
| **4. SMS client logging** | Fixed. Fresh live checks confirm no client SELECT/INSERT/UPDATE; prior deployed minimization trigger prevents raw-message/free-text-error storage. | Retention/parser/telemetry work before enabling the currently disabled SMS feature. |
| **4. Unrestricted country waitlist inserts** | Fixed database exposure: no direct client reads/writes. Controlled validated/rate-limited server flow exists. Cleanup ran successfully on 13/14/15 October at 04:15 Botswana time; zero recorded failures. | Keep public collection disabled until Turnstile/secrets, web deployment, notice and live submission test are ready. Establish ongoing cleanup alerts. |
| **4. Recursive organization/group policies** | Deployed replacement helpers/policies; phase-two tests cover active/joined/pending/former/anonymous/cross-group access without recursion. Migration recorded remotely. | UI smoke tests when these currently unused features are implemented. |
| **4. Config/template sensitivity** | All 12 config rows and 20 templates were classified on 12 October; no credentials found in that snapshot. Fresh live checks confirm only four version/maintenance config keys are client-readable and templates are server-only. | Review new keys/templates as they are added. |
| **5. Platform-admin MFA** | Not implemented/enforced as part of this session. Current admin sign-in uses OTP. | Enrollment, challenge/enforcement, recovery and administrator enrollment/live tests. OTP login alone does not close MFA. |
| **5. Payment-number encryption** | Deployed and verified: six encrypted profiles, zero legacy plaintext values. Service decrypt tests, randomized encryption, role denials and rotation rehearsal passed. Extra authenticated service-function EXECUTE grant revoked live. Committed as `69f8523`. | App/web end-to-end release tests, historical telemetry/provider logs and isolated backup recovery test. Older backups can contain plaintext. Legacy columns remain present but constrained NULL. No actual key rotation was performed. |
| **5. Log each receipt scan** | Audit table/routines and matching audit-enabled parser v8 are deployed. | Live audit table remains empty. Completion API returned 404; checked web production and latest mobile builds reference older commit `91421bb`; production OTA branch is empty. Release and prove scan → edit → save with a populated audit record. |
| **5. Empty consent log** | Consent RPC creation/access controls verified. Three discovered defects fixed and deployed by `20261015220000`: explicit initial processing acceptance, channel-level history and complete marketing withdrawal. New profiles default false. Local and live strict regressions passed. | Real audit table still empty after fixture rollback. Nine profiles have terms/privacy timestamps, but those are not audit history. Verify released registration/preferences calls; do not invent/backdate historical consent. |
| **5. Leaked-password protection** | Enabled and saved in the live Email provider settings. Reopened and confirmed on. Public signup with a compromised test password returned HTTP 422, `weak_password`, reason `pwned`. | Password-reset completion was not exercised; current normal mobile/admin sign-in uses OTP. |
| **6. Future public-table defaults** | Application creator (`postgres`) global/public defaults hardened; explicit grants/RLS/policy guard and CI checks added. Rolled-back new-table test passed. | Fresh live inspection still shows client grants in `supabase_admin` public-table defaults. Requires an authorized managed-role/platform administrator or Supabase support action before marking fully closed. |
| **6. SQL/migration history** | Changes exist under `supabase/migrations`; latest live query confirms all 11 relevant remediation migration versions recorded remotely, including encryption and consent fixes. Encryption is committed as `69f8523`; the consent migration/tests and session verification evidence are included in the follow-up commit. | Production release/push remains pending. Unrelated phone/notification work remains outside this consent/evidence commit. |

## The two questions

**Where is service_role used?** Source review found server-only API routes for
account closure/waitlist work, Edge Functions and an operator provisioning script.
Normal mobile/browser clients use public keys. A complete built-artifact and
deployed-environment secret-exposure audit was not performed, so the unqualified
claim “it has never reached any app or website bundle” is not certified.

**What happens when someone leaves?** The actual `leave_fund` live fixture test
retained the `fund_members` row and changed its status to `left`; it did not delete
the row. Joined-member authorization became false immediately.

## Evidence

- [Protected profiles](protected-profile-verification-2026-10-15.md)
- [Mobile-money verification](mobile-money-verification-recheck-2026-10-15.md)
- [Membership and before-fix consent observations](membership-consent-verification-2026-10-15.md)
- [Deployed consent fixes](consent-fixes-2026-10-15.md)
- [Encryption and recovery limits](payment-identifier-encryption.md)
- [Receipt deployment/builds and cleanup runs](receipt-and-waitlist-status-2026-10-15.md)
- [Leaked-password protection](leaked-password-protection-2026-10-15.md)
- [Phase-one rollout](security-phase-one-2026-10-12.md), [phase-two rollout](security-phase-two-2026-10-12.md), [config/template inventory](security-data-classification-2026-10-12.md)

Final live reconciliation confirmed zero plaintext account-number rows, zero
receipt/consent audit rows, closed mobile-money client writes, false processing
default, three successful cleanup runs, restricted config/template/SMS/waitlist
client access, and the outstanding managed-role defaults/personal-vouch exception.
