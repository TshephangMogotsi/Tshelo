# Mobile API migration guardrails

Status: active migration policy, 18 August 2026

Mobile screens use `lib/api.ts` for application data. Supabase remains the
identity provider, but screens do not use the Supabase SDK as an application
data client after they migrate.

## Permanent boundary

- `lib/api.ts` obtains and refreshes the current Supabase access token through
  `createSupabaseTokenProvider`. It never reads a refresh token directly.
- Authentication UI may call `supabase.auth` for OTP, session, and sign-out
  operations. Profile reads and writes are application data and must use the
  Tshelo API.
- Mobile screens must not call `supabase.from`, `supabase.rpc`,
  `supabase.storage`, or `supabase.functions` after migrating.
- Existing direct callers are recorded in the burn-down list in
  `security/__tests__/mobileApiBoundary.test.ts`. A migration removes entries;
  new entries are not accepted.
- A migrated screen must not keep both `lib/api.ts` and `lib/supabase.ts` as a
  fallback. Rollback is performed by reverting or releasing the prior build,
  not by maintaining two live data paths.

## Screen request state

Use the primitives in `lib/apiScreen.ts` instead of inventing loading and error
semantics per screen.

- `initial`: show the screen's initial loading treatment only when no usable
  data exists.
- `refresh`: retain current data and show pull-to-refresh or a compact progress
  indicator.
- `more`: retain current rows and show a footer progress indicator.
- A refresh or load-more failure retains existing data and exposes a
  non-blocking `ApiUiError`.
- A cancelled request never renders an error.

`createLatestApiRequest()` owns one active request for a screen load. Start a
new signal when route parameters, filters, focus, or refresh state changes, and
call `cancel()` during effect cleanup. Pass the signal through the typed API
method's `ApiCallOptions`.

## Retry policy

- `runApiRead()` is for list and detail reads only. It makes at most two total
  attempts and retries only transport failures, timeouts, or API errors marked
  `retryable`.
- Mutations are not automatically retried. A mutation may opt into retry only
  after its API contract and database operation provide explicit idempotency.
- The shared client independently refreshes an expired Supabase session after
  one `401` and replays the request once. Screens do not implement token retry.
- Validation, authorization, conflict, not-found, and protocol errors are not
  retried automatically.

## Cursor pagination

- Treat `next_cursor` as opaque. Never parse, edit, persist across users, or
  construct a cursor on the client.
- Keep the same filters and sort fields while following a cursor.
- Refresh and filter changes replace the collection and discard the old
  cursor. Load-more appends through `mergeApiPage()`.
- Check `hasMore` and `nextCursor` before loading another page. Use a stable
  resource ID with `mergeApiPage()` to suppress duplicates.

## Error presentation

`toApiUiError()` is the only screen-facing error mapper.

- Display the API's safe message for `TsheloApiError` and preserve its request
  ID and field errors for support and forms.
- Do not display protocol details, raw fetch errors, SQL errors, or unknown
  exception messages.
- Authentication errors return the user to the established sign-in flow.
- Field errors render beside their corresponding inputs.
- Retry actions are shown only when `retryable` is true.

## Server boundary

- API routes authenticate before parsing resource input and use the
  caller-scoped client returned by `authenticateApiRequest`.
- API routes are transport adapters. They validate shared contracts, call the
  server data service, and map the standard response envelope.
- Existing database RPCs remain authoritative for actor identity,
  authorization, locks, state transitions, idempotency, token accounting, and
  audit records. Routes do not reimplement those rules in TypeScript.
- Service-role and secret keys are prohibited from the mobile and API v1
  boundary.

## Per-screen migration checklist

1. Add or complete the shared request and response contracts.
2. Add the caller-scoped server data service and thin API route.
3. Add the typed method to `shared/api-client` with contract tests.
4. Deploy and pass authenticated black-box verification.
5. Replace the screen's Supabase calls with `lib/api.ts` and `lib/apiScreen.ts`.
6. Remove the screen from the legacy direct-access list.
7. Verify initial load, refresh, pagination, cancellation, errors, and the
   successful mutation path.
