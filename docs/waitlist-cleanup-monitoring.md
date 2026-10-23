# Waitlist cleanup monitoring

Migration `20261016120000_monitor_waitlist_cleanup.sql` adds a separate
`tshelo-country-waitlist-monitor` job every 15 minutes. The existing cleanup
still runs daily at 02:15 UTC / 04:15 Botswana time. No waitlist collection or
outbound messages are enabled by this migration.

The monitor detects missing/disabled cleanup jobs, changed schedule/command/
execution identity/database, disabled cron history, failed runs and a missing
successful cleanup. Today's cleanup must complete by 02:45 UTC; before that
deadline yesterday's successful cleanup is required. UTC calculation is
independent of the session time zone.

It preserves individual failed runs, including failures followed by a successful
retry between checks. Repeated checks update existing incidents; successful
recovery marks incidents resolved. Resolved incidents expire after 90 days.
Health state records the last check, last success, expected run and issue codes.
Neither table stores contact details, raw SQL or cron error messages.

New/reopened incidents emit a Postgres warning prefixed
`TSHELO_WAITLIST_CLEANUP`. Health/incidents have RLS enabled, no client grants or
client policies, and explicit service-role SELECT only. The monitor is executable
by the database owner and service role; clients cannot invoke it or write state.

## Operator checks

With an authorized Supabase CLI login, run:

```sh
npm run monitor:waitlist
```

The read-only check is pinned to project `albihofmlafjzbusancu` and exits nonzero
if state is older than 30 minutes, issues/incidents remain open, the monitor is
disabled/misconfigured, its latest scheduled run did not succeed, or access/
connectivity/response validation fails. The first scheduled run must succeed
before it reports PASS. It uses
[`waitlist_cleanup_status.sql`](../supabase/monitoring/waitlist_cleanup_status.sql).

Inspect incidents in the authorized database SQL editor:

```sql
SELECT incident_key, reason, cron_run_id, first_seen_at, last_seen_at, resolved_at
FROM public.waitlist_cleanup_incidents
ORDER BY last_seen_at DESC LIMIT 50;
```

For a failed job, inspect status/timing in `cron.job_run_details`, correct the
underlying permission/function/scheduler problem, and verify a subsequent
successful cleanup and monitor run. An operator can refresh detection with
`SELECT public.monitor_country_waitlist_cleanup();`; this does not execute
cleanup or delete waitlist contacts. Do not copy raw cron errors/contact details
into tickets or public logs.

## Verification and delivery limits

The real pg_cron regression ran in a transaction that was rolled back. It covered
healthy status, UTC deadlines, failures/deduplication, omitted private error text,
recovery, intervening failures, disabled/drifted/missing jobs, overdue runs,
enabled history and role boundaries. The history-disabled branch is tested in
PGlite: hosted `cron.log_run` requires a server restart and was not changed.
Local tests also prove the independent check fails closed.

CI runs the same SQL regression against its disposable Supabase database, and
`npm run verify` includes the local monitor tests. No production contact or
failure fixture is retained by these tests.

This provides scheduled database detection, persistent incidents and searchable
warnings. **It does not configure email, Slack, paging or an independent uptime
service.** A database/scheduler outage cannot run its own monitor; the external
command detects that failure when invoked. An operator-owned external scheduler
and alert destination are still needed for out-of-band notification. No webhook,
recipient, third-party account or new monitoring credential was invented.

## Live rollout — 16 October 2026

Migration recorded remotely; cleanup job 1 remains active at `15 2 * * *`.
Monitor job 6 is active at `*/15 * * * *`. Its first observed pg_cron run,
run 5, succeeded at 08:08 UTC / 10:08 Botswana time in about 14 ms. Only the new
monitor used a temporary one-minute schedule for that canary; its reviewed
15-minute schedule was restored. State is healthy, zero incidents are open,
client access is denied, both tables have RLS, and no simulated cron history
remains. The original four cleanup runs (13–16 October) still show success.
[Sanitized deployment/test evidence](releases/2026-10-16-waitlist-monitor-evidence.json).
