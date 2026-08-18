# Shared API contracts

These TypeScript types define the version-one JSON boundary shared by the Tshelo mobile app, web app, and future API route handlers.

- Contracts contain no React, Next.js, or Supabase imports.
- JSON fields use `snake_case` to match the existing mobile models during the API migration.
- `IsoDate` is `YYYY-MM-DD`, `IsoTime` is `HH:mm:ss`, and `IsoDateTime` is a timezone-qualified ISO 8601 timestamp.
- Every money value uses a base-10 `MoneyAmount` string. JSON numbers are never used for currency values, avoiding floating-point precision loss.
- Every list request is a `ListRequest<Filters, SortField>` with `cursor`, `limit`, `sort_by`, and `sort_direction`. The default limit is 25 and the maximum is 100.
- List responses use `Paginated<T>` with an opaque `next_cursor`; clients must not inspect or construct cursors.
- Filters are explicit per resource and support `OneOrMany<T>` where multiple enum values are valid.
- Statuses are exported as readonly runtime arrays with TypeScript unions derived from them, so validation and types share one source of truth.
- Every endpoint returns the `ApiResponse<T>` success/error envelope and a `request_id`.
- Errors use a closed `ApiErrorCode`, a `retryable` flag, structured field errors, and the shared `API_ERROR_HTTP_STATUS` mapping.
- Authenticated requests follow [the shared Supabase bearer-token rules](./AUTHENTICATION.md). The API verifies the JWT and derives the caller exclusively from its `sub` claim.
- Existing transactional business rules remain in the database. [The RPC source-of-truth inventory](./DATABASE_RPCS.md) identifies which API operations must wrap an RPC, which stay as RLS queries, and which need a new database operation before an endpoint is built.

Database row types belong in the data layer. Route handlers should explicitly map database rows into these public contracts so private or server-owned columns never leak into API responses.

The currently implemented route inventory is documented in [API_V1.md](./API_V1.md).
Client applications consume those routes through the
[shared typed API client](../api-client/README.md).
