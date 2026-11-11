# Live default-privilege verification — 23 October 2026

Project: `albihofmlafjzbusancu`. Result: **partial change; closure not verified**.
The live catalog contains 111 public tables, all with row-level security enabled.

## Defaults still needing attention

- `supabase_admin` public-table defaults still grant all table privileges to
  `anon` and `authenticated`.
- Its public-sequence defaults still grant SELECT, UPDATE and USAGE to both roles.
- Its public-function defaults still grant EXECUTE to both roles.
- Both `postgres` and `supabase_admin` retain implicit global PUBLIC EXECUTE for
  newly created functions. Schema-level revocations do not remove that global default.
- `postgres` public-table and sequence defaults exclude app-user grants.
  Its explicit public-function ACL excludes direct app-user grants, but implicit
  global PUBLIC EXECUTE still applies.

These results do not match a complete deny-by-default change for future public
objects created by both roles. Confirm the project and creator-role scope with
whoever applied the change before declaring it complete. No permissions were
changed during verification.

## Ordinary-role smoke checks

Using an isolated synthetic user/fund/event in a rolled-back transaction, with
`SET LOCAL ROLE authenticated` and matching aal1 JWT claims:

- Fund read passed.
- Event read passed.
- Pending contribution insert passed.
- Independent follow-up found zero synthetic QA users, funds, events or contributions.
- Existing table/sequence/function ACL fingerprints matched before and after our inspection.

This verifies database permissions for those operations. It is not a browser,
native-device, real Auth login or full API flow test. Without a pre-change ACL
snapshot we cannot independently prove that the coworker's work left every
historical grant unchanged.

[Sanitized evidence](releases/default-privileges-verification-2026-10-23.json).
Reproduce the catalog inspection with `scripts/inspect-future-object-defaults.sql`
using the linked project's Supabase SQL query interface.
