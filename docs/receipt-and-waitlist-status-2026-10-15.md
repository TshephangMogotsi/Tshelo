# Receipt deployment and waitlist cleanup — 15 October 2026

Read-only inspection. No deployment, build, OTA release or cleanup invocation
was triggered.

## Waitlist cleanup: scheduled executions verified

Linked Supabase project: `albihofmlafjzbusancu` (Tshelo).

- Migration `20261012170000` is in remote migration history.
- Job 1, `tshelo-country-waitlist-cleanup`, is active.
- Schedule: `15 2 * * *` UTC, daily at **04:15 Africa/Gaborone**.
- Command: `SELECT public.purge_expired_country_waitlist();`.

| Botswana date/time | Run ID | Status | Duration |
| --- | --- | --- | --- |
| 13 October 2026, 04:15 | 1 | succeeded | about 60 ms |
| 14 October 2026, 04:15 | 2 | succeeded | about 84 ms |
| 15 October 2026, 04:15 | 3 | succeeded | about 133 ms |

These are all three recorded executions; no failures appear in the job's
history. The result message was `1 row`, which describes the SQL result row,
not a number of deleted contacts. The waitlist currently has zero rows. This
proves scheduler execution, not deletion of real expired contacts; expiry
behaviour is covered by the existing database regression tests. Ongoing
monitoring/alerting remains separate work.

## Receipt database and parser: deployed

- Migration `20261009110000` is present remotely.
- `receipt_scan_audit_log` exists, with zero rows and zero completions.
- Edge Function `parse-receipt` is ACTIVE, version 8, updated
  12 October 2026 at 10:28:39 Botswana time; platform JWT verification is enabled.
- Downloaded the deployed parser source into a temporary inspection directory.
  Its SHA-256 matches the local source exactly:
  `3b9bbc6584ddefa43f292de4ff4509869b1c109dba2875e5e02ca25aff61095c`.
- Deployed source calls `log_receipt_scan` with model/version/result/failure
  information and returns `audit_id`. Model: `claude-haiku-4-5`.

No actual receipt was scanned during this inspection, so provider execution,
secrets, and a complete model-result-to-user-edits audit have not been verified
end to end.

## Production web/API: completion route missing

Signed-in Vercel dashboard for `diginav/tshelo-admin` shows:

- Production deployment `dpl_HqeWu5PNh6P7t4PBofFp5cSCUKzf` is Ready, created
  8 October 2026, with a 1m 8s build.
- Recorded source commit: `91421bb` (`feat: add Tshelo site favicon`).
- Production aliases shown: `tshelo-admin.vercel.app` and
  `tshelo-admin-55o32o1hz-diginav.vercel.app`.
- This commit precedes security remediation commit `e02e613`, which introduces
  the scan-completion integration. Deployment is shown as stale.

Public API probes at the mobile app's configured origin, `https://app.tshelo.com`:

| Request (no bearer session, empty JSON body) | Result |
| --- | --- |
| POST `/api/v1/receipts/parse` | 401 JSON, `UNAUTHENTICATED`; route exists |
| POST `/api/v1/receipts/scan-completion` | 404 HTML; completion route unavailable |

The app origin was probed separately because the Vercel deployment details did
not list `app.tshelo.com` among its aliases. Its exact deployment association
was not established. Both the dashboard provenance and live API probe show
outstanding rollout work; a successful parse authentication guard does not prove
the entire parse path works.

The Vercel connector returned 403 and the CLI could not access the configured
team/project. The authenticated work-profile browser provided the deployment
details above. No project linking or credential changes were made.

## Mobile: no recorded release of the audit integration

Expo project: `digital-natives/tshelo`, ID
`a0f76b53-0427-41d9-b5a1-a59024570558`.

| Platform | Latest recorded production build | Status | Created | Recorded commit |
| --- | --- | --- | --- | --- |
| iOS | 1.0.1 (9), `78bfcb96-a088-4fbe-8c48-6c3fc01f17d6` | FINISHED | 29 September 2026 | `91421bb` |
| Android | 1.0.1 (12), `4d6d07fe-56df-4749-bcf0-a0b1ed433815` | FINISHED | 25 September 2026 | `91421bb` |

Production channel is active and maps to the `production` branch, which has
zero update groups. No production OTA release provides the missing integration.
The recorded commit's receipt screen lacks `completeReceiptScan`; that call is
present in the current working tree. Build artifacts were not downloaded or
decompiled, and store submission/approval status was not checked. Build commit
metadata does not certify the absence of uncommitted source in an uploaded
archive, but there is no recorded build tied to the remediation commit.

## Remaining closure work

Release the reviewed web/API completion integration and an updated mobile build
(or a separately reviewed compatible OTA release), then scan a controlled receipt,
edit and save it, and verify that one audit entry contains model/version/result
and the corresponding user edits/completion timestamp. Keep the receipt item open
until that end-to-end check passes.
