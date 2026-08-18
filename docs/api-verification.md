# Automated API verification

The verifier makes black-box HTTP requests against a running Tshelo API and
checks the shared response envelope, HTTP status, JSON content type,
`Cache-Control: no-store`, and matching body/header request IDs.

## Safe default suite

```sh
API_BASE_URL=https://your-admin-deployment.example npm run verify:api
```

The default suite calls every API route without authentication and expects a
standard `401 UNAUTHENTICATED` response. Mutation routes receive only
unauthenticated requests, so the verifier never writes production data.

## Authenticated read suites

Use short-lived Supabase access tokens supplied through the environment. Tokens
are never printed by the verifier.

```sh
API_BASE_URL=https://your-admin-deployment.example \
API_ACCESS_TOKEN=short-lived-app-user-jwt \
API_ADMIN_ACCESS_TOKEN=short-lived-platform-admin-jwt \
npm run verify:api
```

`API_ACCESS_TOKEN` enables app-user list reads and invalid-query checks.
`API_ADMIN_ACCESS_TOKEN` enables read-only users, support-ticket, and audit-log
checks. Supplying either token is optional.

Detail reads can be enabled with caller-visible fixture IDs:

- `API_TEST_USER_ID`
- `API_TEST_FUND_ID`
- `API_TEST_EVENT_ID`
- `API_TEST_CONTRIBUTION_ID`

Never commit tokens or place them in checked-in environment files.

## CI coverage

The main verification workflow runs unit tests for the black-box verifier. The
admin workflow builds and starts the production Next.js server, then runs the
safe unauthenticated suite against it. The disposable Supabase job applies all
migrations and runs `supabase/tests/api_v1_boundaries.sql` to verify the actual
functions, grants, RLS policies, columns, and indexes created by the API
migrations.
