# Platform administrator MFA — 22 October 2026

## Scope and implementation

Local implementation covers all active `platform_admins` roles: support,
operations, finance and super_admin. Fund/group administrators are separate;
this change does not add MFA requirements to their ordinary account operations.
Supabase dashboard MFA is separate from application authentication.

The shared login still performs phone/email OTP authentication. Admin dashboard
entry now routes insufficient-assurance sessions to `/mfa`. That page authorizes
only an active platform administrator and exposes enrollment/challenge UI, not
operational data. A verified session returns to the dashboard. Ordinary account
continuations retain their existing behavior.

`MfaForm` uses Supabase Auth TOTP enrollment and challenge/verification. Setup is
explicit, abandoned unverified TOTP factors can be replaced, and verified factors
are never removed by this flow. Factor lookup, enrollment and verification errors
fail closed. Setup secrets stay in component memory and are not logged or saved
by application code. Sign-out submits POST to the existing logout handler.

Page guards require a verified JWT with `aal2`; API authentication carries the
assurance claim from the verified token into platform authorization. Dashboard
queries start only after page authorization. The existing role matrix still
controls each operation after MFA.

Migration `20261022120000_require_platform_admin_mfa.sql` adds the same assurance
requirement to `is_platform_admin` (platform read RLS) and
`require_platform_admin_operation` (the four privileged mutation RPCs). The
self-only role lookup remains available at aal1 for enrollment. Own-account RLS
policies remain applicable. No service-role or emergency MFA bypass was added.

The local TOTP settings are in `supabase/config.toml`. This file does not change
hosted Supabase Auth settings; check those separately before a hosted test.

## Local verification

- Full root `npm run verify`: passed (exit 0), including 555 app/Jest tests,
  298 API/security tests, 67 DOM tests, 362 event-file database assertions and
  all configured database, dependency and tooling suites. This includes the
  new MFA coverage, not a separate claim of hosted GitHub Actions success.

- `npm run verify --prefix admin`: passed typecheck, lint and production build.
  Two existing unused-variable lint warnings remain in unrelated files.
- Database MFA suite: 11 tests exercise the actual new migration and original
  public admin RPCs in disposable PGlite. All four roles reject missing/aal1/
  invalid assurance on every privileged RPC. Tests cover platform read RLS,
  own-profile access, self-role enrollment lookup, verified role restrictions,
  attributed moderation audit writes, inactive admins and assurance downgrade.
- API/page tests cover verified-claim propagation, rejection of unverified JWTs,
  MFA denial for every platform role, role restrictions, failed role lookup,
  redirects and ordinary account continuations.
- DOM tests cover explicit enrollment, abandoned setup, existing factors,
  challenge failure/retry, assurance verification and lookup failures.
- The database suite is included in root `npm run verify`, which GitHub Actions
  already invokes. API and DOM suites use the existing test discovery patterns.

Transport is mocked for API/page and DOM tests. PGlite executes database behavior
with synthetic JWT claims; it does not run Supabase Auth. These checks do not
prove a real authenticator, hosted token refresh, browser cookies across hosts,
full migration replay or live recovery.

## Next: controlled end-to-end test

1. Use a dedicated non-customer admin account in an isolated Supabase test project
   or disposable local stack with Auth and the full migration history. Confirm
   TOTP enrollment/verification is enabled. Never grant test access to a customer.
2. Record the exact source commit, hosted/local configuration and migration set.
3. Complete primary OTP login; verify dashboard pages and admin APIs are blocked
   until TOTP enrollment and verification produce an aal2 session.
4. Verify the QR/manual-key setup using an actual authenticator. Sign out and
   sign back in, test an incorrect/expired code, then complete the challenge.
5. Call admin APIs and direct database RPCs using the aal1 and aal2 tokens; check
   the expected denials, role restrictions and attributed audit rows. Keep tokens,
   QR codes, setup keys and OTPs out of shared evidence.
6. Repeat for the four platform roles, ordinary account access, inactive admins,
   session expiration and re-enrollment after the controlled recovery procedure.
7. Verify routing/cookie behavior on the intended admin hostname and any shared
   app hostname. Confirm database gates and UI are deployed together.

## Recovery and emergency access — production dependency

Nono must nominate a primary recovery approver and a backup. They own identity
verification/approval and custody of any company-controlled recovery material;
engineering implements the approved technical actions and records the evidence.
The production procedure is not yet approved or executed.

Supabase does not provide native recovery codes. Do not promise generated codes
or invent a static password/MFA bypass. Decide whether approved additional factors
will provide the normal fallback, and who may perform an exceptional provider-side
factor reset using restricted server/operator access.

Before production enforcement, rehearse a procedure that:

1. Records the request and independently verifies the administrator's identity.
2. Obtains the designated approval and suspends privileged access if compromise
   is possible. If everyone is locked out, uses separately secured, authorized
   operator access to the hosting/Auth provider rather than a public bypass.
3. Performs the approved provider-side reset and session revocation, recording
   actor, subject, approval, reason, time and outcome without recording secrets.
4. Requires new factor enrollment and verification before privileged access is
   restored, and notifies the affected administrator and recovery owners.

JWTs can remain valid until expiry after factor removal or session revocation.
Validate the actual hosted token lifetime and invalidation behavior; do not claim
immediate revocation from an aal2 check alone. During suspected compromise keep
platform privileges suspended until residual tokens cannot regain privileged
access. Define and test the restoration sequence before production rollout.

## Release and evidence

The implementation and disposable browser workflow have now been committed and
pushed from a separate clean checkout to `codex/platform-admin-mfa-ci`, based on
`40423f432af5be99a03575243b3e5353acf6a169`. Existing unrelated local changes were
excluded. The current browser run is tracked below; local checks alone are not
reported as a hosted integration pass.

No production deployment, hosted Auth update, production migration, real admin
enrollment or Slack message has been performed.

The workflow uses GitHub's Docker-capable runner, so no additional hosted project
or Docker installation on the user's computer is needed. Its CI-only config uses
six synthetic phone OTP fixtures; this does not exercise SMS delivery. Real TOTP
enrollment/verification runs against the disposable Auth service. Only sanitized
JSON evidence is uploaded, and the stack is stopped in an always-run cleanup.

- Workflow: `.github/workflows/platform-admin-mfa.yml`
- Test instructions and limits: `security/e2e/README.md`
- Passing run: https://github.com/TshephangMogotsi/Tshelo/actions/runs/39893841865
- Tested commit: `775f1a9`
- Status: all five browser/Auth/API/database scenarios passed on 23 October 2026.
- Sanitized evidence: `docs/releases/platform-admin-mfa-2026-10-23.json`
- Focused local checks: 12 database tests and four test-safeguard tests passed.

Supabase TOTP enrollment requires a confirmed Auth email, including for phone-login
administrators. The app displays this prerequisite before enrollment; production
owners must arrange verified admin emails. Test fixtures have confirmed synthetic
emails; real email verification and delivery remain outside this test evidence.

The production migration immediately requires MFA for platform database access.
Do not apply it independently of the matching enrollment UI and readiness checks.
First prove the complete flow in the test environment; then coordinate real admin
enrollment and approved recovery arrangements before production enforcement.
An app-only rollback leaves database MFA requirements in place; any database
rollback must be reviewed because restoring the old helpers weakens authorization.

Prepare a sanitized report for #tshelo identifying the tested version, environment,
role matrix, enrollment/challenge results, blocked bypass attempts, recovery test
and remaining dependencies. Local test results are engineering evidence, not a
claim that production enrollment or release sign-off is complete.

References:
- https://supabase.com/docs/guides/auth/auth-mfa
- https://supabase.com/docs/reference/javascript/auth-mfa
