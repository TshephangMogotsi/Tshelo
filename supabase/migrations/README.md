# Migrations

`20260707053236_baseline.sql` captures the full public schema as it existed in
production on 2026-07-07 (88 tables, 13 enums, 44 functions, RLS policies,
triggers, comments), generated from live `pg_catalog` introspection and
validated by executing the whole file against the server in a rolled-back
transaction. It is recorded in the remote migration history, so tooling knows
it is already applied.

The narrative SQL logs in `data/*.txt` / `data/*.sql` predate this baseline
and are historical context only — everything they describe is contained in
the baseline.

## Making schema changes from now on

1. Write the change as a new file here: `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`
   (or `supabase migration new <name>` to create the file).
2. Apply it to production with the Supabase MCP `apply_migration` tool (which
   records it in the remote history) — or `supabase db push` if Docker is set up.
3. Commit the file. Never run ad-hoc DDL in the dashboard SQL editor without
   also capturing it as a migration file.

`supabase/seed.sql` holds reference/config rows (`event_type_config`,
`token_products`) so a rebuilt database is usable, not just structurally
correct.

## Security hardening deployment (2026-07-22)

`20260722090000_security_hardening.sql` closes client-side membership and
profile escalation paths, privatizes receipt storage, and disables the old
push trigger whose credential was committed historically.

Before deploying it:

1. Confirm `supabase migration list` is aligned. The historical timestamp drift
   was reconciled on 2026-07-22 against the migration SQL stored in production.
2. Rotate `PUSH_WEBHOOK_SECRET` and deploy the hardened `send-push` and
   `parse-receipt` functions.
3. For the internal beta, validate the SQL inside a rolled-back transaction
   against the live schema, then deploy it in a controlled backend-first window.
   Use a separate branch/environment later when preparing for public testing.
4. Recreate `send-push` as a dashboard-managed Database Webhook using the new
   secret. The migration deliberately drops the insecure SQL trigger.
5. Verify public/private joins, owner/admin/member permissions, receipt scans,
   receipt access, and push delivery end to end.

## Granular fund administration deployment (2026-08-12)

The granular administration sequence is:

- `20260812155000_fund_admin_permission_foundation.sql`
- `20260812160000_enforce_fund_admin_permissions.sql`
- `20260812170000_retire_legacy_fund_admin_authorization.sql`

All three are deployed to the linked project. A post-deployment dry run reported
the remote database up to date. Aggregate inspection showed 11 active permission
definitions and 22 grant rows, matching two backward-compatible full-admin
grant sets at rollout time.

The final migration keeps `admin` as a relationship label and grant
qualification, but removes it as a standalone operational authorization path.
See `docs/granular-admin-rollout.md` for smoke tests, audit queries, and rollback
posture.

## API v1 database rollout (2026-08-17)

Apply these migrations in order before deploying API v1 mutation and read
handlers:

- `20260817140000_api_source_of_truth_rpcs.sql` adds the transactional event,
  linked-fund, and audited platform-admin RPC boundaries. It also adds support
  ticket resolution metadata.
- `20260817160000_api_read_rls_and_indexes.sql` extends active platform-admin
  read access to the relationship rows required by typed API detail/filter
  queries, and adds deterministic list-pagination indexes.

Both migrations preserve caller identity through `auth.uid()`. The read
migration grants no write privileges, and the mutation RPCs derive the actor
server-side rather than accepting an actor ID from clients.
