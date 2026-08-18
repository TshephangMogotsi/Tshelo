# API authentication rules

These rules define the authentication boundary shared by the Tshelo mobile app, web app, and API.

## Client responsibilities

1. Clients continue to sign users in through Supabase Auth phone OTP. OTP creation and verification do not move into the Tshelo API.
2. After Supabase verifies the OTP, the client uses the session's short-lived `access_token` as its API credential. Supabase remains responsible for session persistence and refresh-token rotation.
3. Every authenticated API request sends the current access token in exactly one header:

   ```http
   Authorization: Bearer <supabase-access-token>
   ```

4. Clients never send an OTP, refresh token, Supabase publishable/anon key, or a user ID in place of the bearer access token.
5. After a `401 UNAUTHENTICATED` response, a client may ask Supabase to refresh its session and retry the request once. If refresh or the retry fails, the client returns to sign-in rather than looping.

## API responsibilities

1. The API accepts only a three-part JWT in the `Authorization: Bearer` header. Missing or malformed credentials return the standard `401 UNAUTHENTICATED` error envelope.
2. The API verifies the token with the configured Supabase project's `auth.getClaims(accessToken)`. It never trusts `getSession()` or an unverified decoded payload for server-side identity.
3. The verified JWT must represent the `authenticated` Supabase role and audience.
4. The API derives the authenticated actor exclusively from the verified `sub` claim. Route handlers receive this value as `actor.user_id`.
5. Body, path, and query user IDs may identify a resource or an admin-operation target, but they never override the authenticated actor. Each endpoint must separately authorize the actor against the requested resource or operation.
6. Database work uses a Supabase client scoped to the caller's same access token, preserving Row Level Security and `auth.uid()`. Purpose-specific `SECURITY DEFINER` RPCs provide the narrow privilege required by audited platform-admin mutations. A service-role client is reserved for exceptional backend-only work that cannot be expressed safely through RLS or a narrow RPC.
7. Invalid, expired, wrong-project, anonymous, and service-role tokens are not accepted as user authentication.
8. Authentication failures do not expose token contents or Supabase verification details in responses or logs.

The existing admin website may continue to use its Supabase cookie session internally. Calls through the shared API boundary still follow these bearer-token rules.

## RLS and privileged access

- User and read-only platform requests use the caller-scoped client returned by `authenticateApiRequest`. That client forwards the verified user JWT, so database Row Level Security remains authoritative.
- Platform-admin handlers use `withPlatformAdminOperation` in `admin/lib/api/platform-admin.ts`. It checks the closed application role matrix, then calls the operation-specific RPC with the caller-scoped client.
- Each privileged RPC independently checks the active `platform_admins` row and exact role, locks and mutates the target, and writes the audit record in the same transaction. The verified actor remains available as `auth.uid()` throughout.
- The elevated-operation list and role matrix are closed constants in `shared/contracts/admin.ts`. Adding a privileged operation requires an explicit policy change and tests.
- Platform reads do not need service-role access. The initial elevated operations are ticket updates, user moderation, fund moderation, and platform-admin management. Finance remains read-only until a specific finance mutation is designed.
- Every privileged mutation must record the verified actor ID, operation, target, and timestamp in the platform-admin audit log. The database function performs the mutation and audit insert atomically.
- Route code must not read a service-role key for these four platform mutations. If a future backend-only workflow genuinely requires service-role access, it needs a separately named, tightly scoped guard, explicit authorization policy, and tests. No secret value may use a `NEXT_PUBLIC_` prefix or leave the server environment.
