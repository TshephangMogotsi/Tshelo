# Pre-beta security fixes — 2 November 2026

These are source changes, not a production rollout or launch clearance.

- Ordinary contact recovery now excludes every platform administrator, including suspended administrators after factor removal. Regression tests cover active/inactive accounts at both start and finish.
- Beta provisioning uses a private five-minute, single-use approval bound to the exact generated Auth user ID and normalized email. The profile trigger consumes that approval during insertion, before custom app metadata is applied. Public signup cannot authorize itself through user metadata; the existing registration gate and approved-email list remain required.
- Payment updates require an OTP or MFA authentication-method timestamp within five minutes (with 30 seconds of future clock tolerance). Token refresh/issued-at alone is insufficient. Enforcement is inside the database RPC, including direct callers. A rejected request asks the user to sign out and sign in again. Existing encryption, verification resets and owner notices remain in place.
- Compatible dependency overrides pin decode-uri-component 0.5.1, undici 6.29.1 and Zod 4.6.6.

Apply the new migrations in order, before deploying the matching website/API:
1. `20261102090000_bind_beta_signup_authorization.sql`
2. `20261102100000_require_recent_payment_auth.sql`

Prerequisites are the existing email-registration and payment-encryption migrations. These new migrations do not enable registration or contact recovery. The native decoder update requires a newly distributed app build/update; installing dependencies locally does not patch installed user builds.

Verification: the real trigger and payment RPC were exercised in disposable PGlite with minimal fixtures (no Docker); API regressions, dependency exploit regressions, and admin typecheck/lint were run. The PGlite payment test stubs encryption to isolate the fresh-auth control; the existing SQL encryption suite retains real Vault/pgcrypto checks for the normal database CI environment. Hosted provider registration and recovery still require a controlled end-to-end check.

Current production Auth settings, static test OTP removal, administrator enrollment and migration state could not be rechecked because the available management credential returned HTTP 401. These remain release prerequisites. No production configuration or account was changed by this work.

Results: 312 API/security tests, 27 dependency regressions, 2 database integration tests and 10 API-boundary/CI tests passed. App/admin typechecks and admin lint passed (two existing unrelated lint warnings). Fresh dependency audits report zero high/critical findings; root retains 41 moderate and 5 low findings, admin retains 16 moderate findings.
