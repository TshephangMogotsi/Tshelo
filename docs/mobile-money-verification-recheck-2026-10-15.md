# Item 2 — live reconfirmation, 15 October 2026

Project: Tshelo, `albihofmlafjzbusancu`.

## Completed-fix update ready to post

> **Item 2 completed — reconfirmed live on 15 October.** Client inserts into
> `mobile_money_verifications` are blocked, and `mmv_insert` has been removed.
> Anonymous and signed-in users cannot create, update or delete verification
> records, including `status`, `received`, `received_amount` or `phone_matches`.
> Trusted backend/service-role creation and updates remain available.
>
> Live tests confirmed rejection of forged approvals and direct changes to
> `users.mobile_money_verified`. Signed-in users can only read their own
> verification records. All synthetic test records were rolled back.
>
> No current mobile/web/Edge caller or public database function consumes these
> verification records or trusts client-authored verification status. The live
> table is empty. Provider-backed ownership verification is still a separate
> implementation task; this fix closes client-write access.

## Live evidence

- Migration `20261012120000_phase_one_client_table_hardening.sql` is recorded
  remotely; RLS is enabled.
- The only current table policy is `mmv_select`, SELECT for authenticated users
  with `user_id = auth.uid()`. No INSERT, UPDATE, DELETE or ALL policy exists.
- PUBLIC/anon/authenticated write privileges were revoked by the deployed
  migration. Effective checks confirm anon/authenticated have no table/column
  INSERT or UPDATE, no DELETE and no TRUNCATE. This includes inherited grants.
- Anonymous users have no SELECT. Authenticated users have owner-scoped SELECT.
- Service role retains SELECT/INSERT/UPDATE/DELETE permissions.
- Baseline live table count: zero records. No existing customer verification
  data was read or changed.

The strict transactional live check returned:

```json
{
  "result": "PASS",
  "client_operations_denied": 11,
  "table_and_column_write_grants_closed": true,
  "client_write_policies_absent": true,
  "owner_only_reads": true,
  "service_create_update": true,
  "fixtures_rolled_back": true
}
```

For each of anon and authenticated, the test attempted a forged verified INSERT,
status UPDATE, evidence-field UPDATE, DELETE, and direct profile verification
flag UPDATE. All ten were denied with insufficient privilege. Anonymous SELECT
was also denied. The authenticated fixture owner could read its backend-created
record and could not read the second fixture user's record. Service role could
create and update verification records. The test rolled back all fixtures before
returning PASS and checked that their user/verification IDs no longer existed.

Reproduce:

```sh
supabase db query --linked --file security/fixtures/transactional-mobile-money-verification.sql --output json
```

## Trust-path review and limits

Repository searches across mobile, web, shared contracts, Edge Functions and
other active source found no verification-table caller. The linked database has
no public function body referencing `mobile_money_verifications`, `phone_matches`
or `received_amount`. Rewards/trust logic reads the protected
`users.mobile_money_verified` flag, rather than a client-supplied verification
record status; direct client flag mutation was denied in the live test.

This reconfirms the deployed access fix. It does not certify an ownership
verification/provider callback flow: no such integration currently exists.
Any future integration must create challenges on the backend and accept success
only from authenticated provider evidence.
