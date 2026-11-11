# Profile email identity — 3 November 2026

Status: **closed on 6 November 2026** for the confirmed `tshelo-admin.vercel.app` deployment and linked Tshelo production database. The compatible API is live and client email UPDATE permission is revoked. [Machine-readable production evidence](evidence/profile-email-identity-2026-11-03.json).

## Original finding confirmed

The production `authenticated` role could UPDATE `public.users.email`. The profile table had no unique email constraint. The verified Auth-email sync trigger existed in local source but was not installed on production. Email verification in the public deletion flow proved mailbox possession, while the original consumer still chose an account by `public.users.email`. It did not bind proof to a trusted account ID. A uniqueness constraint alone would not make a self-asserted email trustworthy.

## Applied database protection

Migration `20261103100000_secure_profile_email_identity.sql` was applied atomically and recorded in the linked Tshelo production migration history on 3 November. It:

- Installs a fixed-search-path Auth trigger that syncs confirmed email changes and first email confirmations, preserving the owner security notification. A changed, unconfirmed Auth address is rejected.
- Blocks profile email updates, including clearing the field, unless the new value matches that account's confirmed Auth email. The guard also applies to privileged application writes; ordinary name/preferences edits remain available.
- Reconciles historical profile values from confirmed Auth email. The aggregate count of active profiles differing from confirmed Auth fell from one to zero. Unconfirmed Auth addresses do not overwrite profile values.
- Adds a service-only identity resolver using confirmed `auth.users.email`, joined by immutable account ID to an active profile. It normalizes case/whitespace and fails closed on zero or multiple matches. No uniqueness assumption about profile email is required.
- Binds new deletion verification rows to `account_user_id` at insertion, including inserts from the existing deployed API. A supplied conflicting ID is rejected.
- Makes the token consumer recheck the bound account against confirmed Auth identity. A forged historical profile address cannot select a ticket recipient. Changed-address, expired, replayed and legacy unbound tokens fail closed.

Existing unbound links must be requested again. The pre-rollout count of unexpired, unconsumed tokens was zero. This flow creates a support request; it does not directly delete an account.

Independent production catalog verification passed and all five deployed function bodies match the reviewed migration source. No test Auth users, verification emails or deletion tickets were created on production.

## Completed compatibility release and final grant removal

Phase one temporarily retained the email UPDATE grant while the database trigger rejected unverified changes. Older installed clients send the unchanged email along with name edits, so the API compatibility update was released before final grant revocation.

The deployed API accepts an unchanged legacy email, checks it against the caller's current profile, and omits it from the database UPDATE. Actual changes or clearing return a verification-required validation error before any mutation. The web profile displays email read-only. The deployed deletion initiation route calls the trusted Auth identity resolver and explicitly binds the token to the returned account ID. The native read-only UI is prepared for normal app distribution; backend protection does not depend on installing it.

Migration `20261103101000_revoke_profile_email_updates.sql` was applied and recorded after the compatible API was promoted. Independent execution of `supabase/monitoring/profile_email_identity_verification.sql` passed on 6 November at 09:42 CAT (07:42 UTC): both `authenticated_email_update` and `anonymous_email_update` are false. Both migration records were independently confirmed. Actual UPDATE statements under `authenticated` and `anon` were rejected with `insufficient_privilege` in no-row probes (`WHERE false`); no application data was created or changed. The evidence preserves the earlier phase-one state as history alongside the final result.

The user confirmed Diginav's `tshelo-admin` project (`prj_JDpKznplQ4uuLQNB0Ioiqz5gkZ0L`) and `tshelo-admin.vercel.app` as the intended target. Its prior live source was reconstructed and 321 source files verified by content hash. Only the six profile-email/API files in [the release patch](evidence/profile-email-release-2026-11-06.patch) were changed; unrelated working-tree edits were excluded. The patch SHA-256 is `2f68c3b4695257e279f68fed7f05ac071152a68be369012a030d30db72cc71e9`.

Deployment `dpl_Fdgib9nPJGNhQB78uiSedvFtR93t` (`tshelo-admin-mhwd9hrlu-diginav.vercel.app`) passed its production build, exact-candidate typecheck and all 11 targeted API tests. The staged HTTP smoke checks passed and were repeated before promotion. The live alias was independently inspected after promotion. All five live smoke checks then passed after database grant revocation: new compatibility schema, denied unauthenticated profile reads/writes, a generic no-match deletion response without sending email, and the public deletion page.

The Vercel connector could not access the project; the existing authenticated Vercel CLI was used. `app.tshelo.com` routing was not changed and remains outside this closure. The preserved dependency set reported one pre-existing high and 16 moderate advisories during the build; this closure is not dependency or overall launch clearance.

## Validation

- Full application migration replay in disposable PGlite, with minimal Supabase service catalog substitutes. The identity SQL suite executes both before and after phase-two grant revocation.
- Direct authenticated forged-email updates and clearing are rejected; ordinary name edits and phase-one unchanged-email saves work.
- A historical forged duplicate profile email cannot redirect a deletion ticket. Wrong bindings and unconfirmed addresses are rejected. Verified Auth sync and its owner notice work.
- Expiry, token replay, email changes and legacy unbound links are rejected.
- All 319 API/security tests across 41 suites pass, including unchanged-email compatibility, rejection before mutation, trusted initiation and generic no-match responses.
- All 72 web tests across nine suites pass. App, admin and API-test typechecks pass. Targeted admin lint reports no errors and two existing warnings.

The local replay does not exercise real hosted Auth email delivery, Vault/pgcrypto, scheduler execution or full signed-in browser flows. Those limits do not change the independently verified absence of the vulnerable client grant. The native UI update follows normal distribution. The reported profile-email/deletion-identity audit finding can be marked closed.
