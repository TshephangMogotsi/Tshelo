# Shared Tshelo API client

This framework-neutral client is the integration boundary for the React Native
app, Expo web, and interactive admin components. It consumes the types in
`shared/contracts` and unwraps successful `ApiResponse<T>` envelopes.

It provides typed methods for the currently implemented users, funds, events,
contributions, support-ticket, admin-audit, moderation, and platform-admin
routes. List filters use the same contract fields as the API, including opaque
pagination cursors.

## Authentication

`createSupabaseTokenProvider` reads only Supabase's short-lived access token.
The client sends it as a bearer token. After a `401`, it asks Supabase to refresh
the session and retries exactly once. Refresh tokens remain inside the Supabase
SDK and are never sent to the Tshelo API.

## Errors

API failure envelopes throw `TsheloApiError`, preserving the safe error code,
retryability, field errors, HTTP status, and request ID. Malformed JSON,
unexpected error codes, missing/mismatched request IDs, or inconsistent HTTP
statuses throw `TsheloApiProtocolError`.

## Application adapters

- `lib/api.ts` creates the mobile/Expo client using
  `EXPO_PUBLIC_API_BASE_URL` and the existing Supabase Auth session.
- `admin/lib/api-client.ts` creates a same-origin browser client.
- Admin Server Components continue calling server-side data services directly;
  they should not make HTTP requests back into their own deployment.

Existing mobile screens remain on their current Supabase path until the API
migrations and routes are deployed. Migrate one resource flow at a time after
running the authenticated API verifier, keeping a rollback path during rollout.
