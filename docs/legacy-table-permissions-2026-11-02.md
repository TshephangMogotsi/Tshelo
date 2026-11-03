czn# Legacy table permissions — verified closed, 3 November 2026

The broad legacy grants finding is closed based on independent production verification on 3 November 2026. The migration was already applied when authenticated access was restored; this follow-up verified the hosted state without changing production permissions or application records. Machine-readable results are in [the closure evidence](evidence/legacy-table-grants-2026-11-03.json).

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

## Follow-up validation — 3 November 2026

`npm run test:legacy-table-grants` now also replays all 85 checked-in application migrations, in order, with historical blanket client grants. It runs seven existing SQL suites against the resulting application schema: legacy grants, future-table security, fund administration, API boundaries, consent, receipt audit and vouch membership. The new read-only snapshot and production verification queries also execute successfully against that schema. All three Node tests pass, including the focused role-boundary and transaction-rollback tests.

Before committing, the exact staged candidate was exported and tested separately: all three tests also passed with its 83 migrations. That candidate excludes two unrelated, uncommitted beta-signup/payment-auth migrations present during the original 85-migration workspace check.

The replay runs in disposable PGlite. Auth claim helpers and minimal Storage, Vault and Cron catalogs are supplied by `security/fixtures/legacy-schema-replay.sql`; extension creation is omitted. This validates the application schema, policies, grants and permission suites, but does not test real Vault/pgcrypto, hosted Auth, Storage services or cron execution. The real disposable-Supabase CI matrix was not executed in this environment, which has no Docker/Postgres runtime. Production verification below independently establishes the deployed ACL state.

## Production closure status

**Closed for this grants finding.** The linked production project is `Tshelo` (`albihofmlafjzbusancu`). Verification passed on 3 November 2026 at 11:49 CAT (09:49 UTC).

- Migration history records `20261102105000_explicit_vouch_read_grants` and `20261102110000_tighten_legacy_table_grants` as applied.
- All 111 public application tables have RLS enabled. All 108 surviving inventoried legacy tables are included in the new security guard.
- Zero public tables grant anonymous SELECT/INSERT/UPDATE/DELETE. The only anonymously readable columns are `countries.code`, `countries.name` and `countries.is_launch_country`.
- The security guard passes, including checks against structural client privileges and authenticated grants without a matching policy. Its deployed function body matches the reviewed source (MD5 `71f7a9ab6b685af1c5cc9eb34d34bf7d`, used as a content comparison).
- Actual anonymous REST requests for users, funds, events, fund membership, contributions and expenses are denied with HTTP 401 / PostgreSQL `42501`. The public country query used by the waitlist succeeds with HTTP 200 and 12 countries.
- Authenticated-role SELECT permission and query-planning checks pass for profiles, funds, events, membership, contributions and expenses in a read-only transaction using `LIMIT 0`. These checks do not claim a real user login or mutation flow.

The captured production snapshot is post-migration, so this follow-up cannot provide a historical before/after comparison of service-role grants or RLS policies. Preservation is covered by local regression tests. The website request `GET https://app.tshelo.com/waitlist` returned HTTP 404 even though its underlying country query succeeds; full waitlist UI deployment and authenticated business-flow smoke tests remain separate release checks. This closure does not certify those flows or the overall release.

Audit response: “RLS-only is not the intended approach. Legacy blanket client grants have been tightened in production. Anonymous access is limited to the three country fields required for public country selection; authenticated operations require corresponding RLS policies. Automated checks now include legacy tables, and independent production permission verification passed on 3 November 2026.”

## Procedure for future rollouts

1. Inspect the linked project's migration history and candidate dry run. Include only reviewed prerequisites and the legacy-grants migration; the working tree also contains unrelated security changes that must not be deployed implicitly. Run the disposable-Supabase database CI matrix on the exact candidate.
2. Save the output of `supabase/monitoring/legacy_table_grants_snapshot.sql` before rollout. It captures table/column ACLs, owners, RLS flags, policies and the prior guard definition without reading application records. Retain this output as operator rollback metadata.
3. Apply the reviewed migration atomically and record it in the project's migration history. It aborts on failed security assertions. Do not run the rollback-fixture SQL suites against production.
4. Run `supabase/monitoring/legacy_table_grants_verification.sql` against the linked project and retain the timestamped PASS result. This is read-only and independently rejects broad anonymous/structural grants even if an older guard were still installed. Capture the post-rollout snapshot and compare retained service-role permissions and unchanged policies with the pre-rollout evidence.
5. Smoke-test deployed application flows using designated test accounts, and distinguish permission verification from full release clearance.

The evidence queries can be run without a direct database password after CLI login:

```sh
SUPABASE_TELEMETRY_DISABLED=1 supabase db query --linked \
  --file supabase/monitoring/legacy_table_grants_snapshot.sql
SUPABASE_TELEMETRY_DISABLED=1 supabase db query --linked \
  --file supabase/monitoring/legacy_table_grants_verification.sql
```

The snapshot query is suitable before and after a future rollout; run the verification query after rollout. The current closure is backed by the hosted PASS and HTTP results linked above, not just local tests.
