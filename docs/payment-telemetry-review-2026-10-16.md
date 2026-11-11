# Payment-number telemetry review — 16 October 2026

Result: **no current bank/mobile payment identifier matches found in the
accessible surfaces checked**. This is a scoped exposure check, not a guarantee
about every historical number, backup, device or third-party provider.

## Available evidence

- Supabase: **1,640 retained events** returned for 8 October through the check
  time on 16 October, queried in windows of at most 24 hours. Eleven sources
  were represented: Auth/Auth audit, API gateway, Edge invocation/function,
  Postgres, PostgREST, PgBouncer, Realtime, Storage and Supavisor. None of the
  daily 10,000-event bounds was reached.
- Vercel `diginav/tshelo-admin`: **17 returned request/log records**, requested
  over seven days with a 1,000-record bound. Actual returned timestamps span
  **07:22–07:36 UTC on 16 October**, with **zero nested application log entries**.
  This checks retained request metadata; it does not establish a clean history
  of application messages.
- Seven encrypted profiles, including the explicitly approved synthetic QA
  profile, supplied the current comparison identifiers. No identifier was too
  short for the comparison. Exact values and common phone separator variants
  were compared against Supabase message/attribute data and Vercel records.
  Values existed only in operator process memory, were not used as external log
  search terms, and were not printed or saved. No Vault encryption key was retrieved by the operator.
- Ten database telemetry/history tables: **200 rows** checked. `audit_log` 113,
  notifications 85, platform-admin audit 1, receipt audit 1. API usage, SMS,
  mobile verification, payments, login notices and account closure verification
  tables were empty. Exact comparison happened inside PostgreSQL and returned
  only aggregate counts. Zero bank/mobile matches and zero named non-null
  identifier string values were found.
- Fourteen events mention payment field names: thirteen Postgres entries and one
  API SELECT projection. Three SQL events contain number-looking literals, all
  matched to synthetic encryption/protected-profile regression fixtures. No
  customer/current identifier matched; synthetic test literals were not copied
  into this report.
- Vercel current and legacy log-drain listings returned zero destinations for
  the accessible team. Supabase's documented v2 log-drain listing returned
  **403**; external Supabase forwarding configuration remains unverified.
- Reviewed payment UI/API paths do not emit payment bodies to console or a
  configured analytics SDK. API database errors log request ID/error code rather
  than request bodies or raw database error details. Database statement logging
  is `ddl`, and error-statement logging is `error` in the inspected live settings.

Only sanitized counts, timestamps, source names and event IDs are retained:
[provider telemetry evidence](releases/2026-10-16-payment-provider-telemetry.json)
and [database evidence](releases/2026-10-16-payment-database-telemetry.json).
Raw logs, request headers, signed URLs, keys and payment numbers are excluded.

## Limits that remain

Current-value matching cannot find an old value that was subsequently changed,
unknown encoding, masked/truncated values or telemetry that was never collected
or has expired. Source field-name mentions alone are not proof of a leaked
number. The inaccessible `app.tshelo.com` deployment, private payment/SMS-provider accounts, historical exports/backups and
device crash reports are outside this result. Supabase log-drain configuration
requires access from an authorized owner/operator with analytics configuration
read permission. No retained data or backups were deleted or modified.

The approved synthetic live API run independently verified encrypted payment
storage, null plaintext columns, verification reset, identifier-free owner
notice and omitted identifiers in the returned profile. See
[live QA](live-qa-verification-2026-10-16.md). Full backup restore/recovery and
provider-backed ownership verification remain separate checks.

Queries follow the official [Supabase logs API/SQL guidance](https://supabase.com/docs/guides/observability/advanced-log-filtering)
and [log-drain access reference](https://supabase.com/docs/reference/api/v2-list-log-drains).
