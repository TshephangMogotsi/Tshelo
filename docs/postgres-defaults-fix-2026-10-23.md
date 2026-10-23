# Postgres future-object defaults — 23 October 2026

Applied migration `20261023160000` to project `albihofmlafjzbusancu` and recorded
it in Supabase migration history. Only this migration was applied; other pending
migrations were not run.

All effective automatic PUBLIC/anon/authenticated grants for future postgres-owned
public tables, sequences and functions are now absent. Function PUBLIC EXECUTE
was revoked globally, since schema-level revocation cannot override it. This
global function default applies to future postgres functions in every schema;
new client-callable functions require an explicit grant. Existing ACLs and
service-role schema defaults were preserved.

Verification:
- Local regression checks passed, including repeat application, inherited defaults,
  existing ACL preservation, managed-role isolation and explicit grants.
- Live temporary table, sequence and function probes denied both client roles.
- An explicitly granted table read and function call worked as authenticated.
- Service-role access remained available on the temporary objects.
- Probe objects and their data were rolled back before committing the default change.
- Existing public table/sequence/function ACL fingerprints and managed-role
  defaults matched the snapshot taken inside the application transaction.
- Independent post-commit inspection found no remaining postgres client defaults;
  all 111 public tables retain RLS.

The earlier ordinary-role fund/event reads and pending contribution insert passed
in a rolled-back transaction. No browser/device test or full login/API flow was run.

## Remaining managed-role work

`supabase_admin` still grants automatic public-table, sequence and function access
to anon/authenticated, and global PUBLIC function execution remains. Current
postgres access is not a member of that managed role. This part remains open.

[Reviewed handoff SQL](supabase-admin-defaults-handoff-2026-10-23.sql) is prepared
for the authorized managed-role administrator or Supabase support, but has not
been executed. It changes future defaults only and preserves existing ACLs.

[Sanitized live evidence](releases/postgres-defaults-fix-2026-10-23.json).
