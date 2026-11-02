# Legacy table permissions — source fix, 2 November 2026

This addresses the broad existing grants noted in the handover review. It is a source migration, not a claim that hosted permissions have changed.

Migration: `supabase/migrations/20261102110000_tighten_legacy_table_grants.sql`.

## Changes

The migration uses the existing `security_legacy_tables` inventory. For each surviving public application table in that inventory it first records the existing effective rights that should remain, then removes the blanket PUBLIC/anon/authenticated table and column grants and restores only the recorded supported rights. It does not grant an authenticated operation that was previously unavailable.

| Role | Permissions retained |
| --- | --- |
| Anonymous | Existing SELECT on `countries.code`, `countries.name`, and `countries.is_launch_country` only. The public waitlist selects the first two and filters on the third. Other anonymous table access is removed. |
| Authenticated | Existing SELECT/INSERT/UPDATE/DELETE operations supported by an applicable permissive RLS policy. Existing column-only restrictions stay column-only. Constant-false and restrictive-only policies do not justify a grant. |
| Service role | Existing table/column rights are preserved, including rights previously inherited through PUBLIC. No server capabilities are newly introduced. |

TRUNCATE, REFERENCES and TRIGGER rights are removed from client roles. These are unnecessary for application callers; RLS does not protect TRUNCATE. Separate column grants are explicitly handled because a table-level REVOKE does not remove them.

RLS policies, ownership, function permissions, sequence grants and application data are unchanged. Existing owner-executed RPCs can still perform their intended server-side mutations. The private backend tables remain private.

The application security guard now checks older tables too. Its previous legacy exemption is removed, and anonymous access is restricted to the listed country columns. Unsupported client grants, structural privileges, and missing RLS fail the guard. If inherited role grants cannot be removed by this migration, the guard fails and the transaction rolls back rather than claiming success.

This is a conservative cleanup based on existing policy-supported operations. It does not claim that every surviving policy or every column of a retained table-level grant has been independently audited for business necessity. The separate profile-email finding remains separate work.

## Validation

`npm run test:legacy-table-grants` executes the actual migration and `supabase/tests/legacy_table_privileges.sql` in disposable PGlite, without Docker. Coverage includes owner/cross-user RLS, column-restricted profile updates, read-only tables, denied operations, an owner-executed mutation RPC, PUBLIC inheritance, anonymous waitlist filtering, service-role access, no widening of previously absent grants, guard regressions on legacy tables, repeat application and rollback on missing RLS.

`supabase/tests/legacy_table_privileges.sql` is also wired into the existing disposable-Supabase CI job. It uses catalog checks and rollback-only fixtures, without cross-role temporary assertion functions. The CI workflow configuration regression tests pass locally.

The complete production schema and migration history have not been replayed in this focused check. Before deployment, run the existing database CI matrix plus the new SQL test on the full candidate. Capture the current ACLs for operator rollback, and smoke-test the deployed waitlist, profile, fund/event membership and finance paths. Do not run this migration until that candidate is reviewed. It runs atomically and aborts on a failed security assertion.
