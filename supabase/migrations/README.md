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
