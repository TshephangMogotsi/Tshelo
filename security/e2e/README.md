# Platform-admin MFA browser integration tests

Run by `.github/workflows/platform-admin-mfa.yml` on a disposable GitHub-hosted
Ubuntu runner. No hosted Supabase project or production credentials are needed.

The workflow uses the runner’s installed Chrome, starts local Supabase Auth/PostgREST/Postgres,
applies the committed migration history, builds the admin app against that stack
and runs five serial browser scenarios. The first failure stops later scenarios.

`prepare-stack.mjs` copies migrations into a temporary directory and creates a
CI-only config. Six synthetic phone numbers use Supabase's fixed primary test OTP
(no SMS provider or delivery is exercised). Authenticator enrollment and TOTP
verification run against real Supabase Auth; TOTP codes are calculated from the
setup key rendered by the real enrollment UI. No Auth/API/database transport is
mocked. No bypass route or test-only application authentication is introduced.

Coverage:
- Primary OTP login through the actual browser form and aal1 page/API denials.
- All four platform roles, direct RLS reads and all four direct privileged RPCs.
- QR/manual-key enrollment, incorrect TOTP denial and successful aal2 sessions.
- Verified role permissions and attributed mutation audit records.
- Sign-out and repeat sign-in requiring the existing authenticator.
- Inactive administrator denial and ordinary account access.

The runner refuses any Supabase endpoint other than http://127.0.0.1:54321.
`export-env.mjs` masks disposable keys and points both the built app and tests to
the same local stack. The test configuration refuses a mismatch. The service-role
key is used only for creating and disabling synthetic fixtures. All application
API and direct database checks use the tested user's JWT.

Screenshots, video and traces are disabled because they can expose setup keys or
tokens. Only `mfa-e2e-evidence.json` is uploaded: source SHA, scenario outcomes,
sanitized check names and cleanup status. No raw provider error objects, session tokens,
OTP values or setup keys are included. The stack is removed in an always-run step.

Local prerequisite checks (no Docker or secrets):

```
npm ci --prefix security/e2e
npm run check --prefix security/e2e
```

Full integration execution requires the disposable stack and a matching production
build; GitHub Actions supplies both. The local prerequisite checks and test
listing do not establish that the real browser/Auth/database scenarios passed.

This does not test SMS delivery, cross-domain production cookies, natural session
expiry, factor-reset recovery, or enrollment by actual platform administrators.
Those remain coordinated rollout checks. The fixed primary OTP configuration is
created only under RUNNER_TEMP and must never be applied to a hosted project.
