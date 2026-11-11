# Approved synthetic live QA — 16 October 2026

Result: **PASS** for authenticated API receipt, payment and consent checks on
the promoted `diginav/tshelo-admin` production build. The user explicitly
approved creating labeled persistent synthetic records and disabling the account
afterward. No customer account or historical consent record was modified.

Target: `https://tshelo-admin-9aof51s3l-diginav.vercel.app`, deployment
`dpl_B4vb5wA6jaEmnHpM92nAi58hbD9d`, also promoted to
`https://tshelo-admin.vercel.app`.

All application API requests used an ordinary `authenticated` QA session.
Server credentials were used only in the local operator process for fixture
provisioning, evidence reads and cleanup; they were not supplied to the website.
The [sanitized evidence](releases/2026-10-16-live-qa-evidence.json) includes
request IDs and fixture IDs, with no credentials, passwords or signed URLs.

| Check | Live result |
| --- | --- |
| Own-profile read | 200 with the caller's ID |
| Protected balance assignment | API rejected with 422; direct database update also denied |
| Initial processing acceptance | Created a `data_processing/granted` audit record |
| Channel-only SMS opt-in | Created a `marketing_sms/granted` record |
| Aggregate withdrawal with conflicting email opt-in | All marketing flags became false; withdrawal records created |
| Dummy bank/provider change | 200; ciphertext stored, plaintext NULL, bank/mobile verification reset, owner notice created without the account identifier |
| Synthetic receipt upload | Upload-session 201; signed upload succeeded |
| Actual provider parse | 200; `claude-haiku-4-5`, version `claude-haiku-4-5-20251001` |
| Reviewed receipt completion | 200; reviewed vendor/items and completion timestamp persisted |
| Expense save | 201; one synthetic BWP 26 expense persisted |

Retained evidence:

- QA user: `0397b4ab-d593-45c1-b633-a1c1d4b2b095`, named
  `Synthetic Release QA 2026-10-16` and marked synthetic in Auth metadata.
- QA fund: `c7d162eb-8458-4464-a61e-3147183a1ba3`, titled
  `Synthetic release QA - no real purchases`.
- Receipt audit: `5c9b15d4-85d8-4ec6-a852-c70a17383309`.
- Expense: `9dd07bf2-9ebb-4a71-84fa-2ec1170dea9f`.
- Nine consent audit entries covering terms/privacy acceptance, processing,
  channel grants and marketing/channel withdrawals. These are synthetic QA
  decisions, not evidence of customer consent or a historical backfill.

Cleanup was verified independently: Auth identity banned, password replaced,
public profile banned, zero Auth sessions, zero refresh tokens, fund completed.
The explicit sign-out call after banning returned an error; direct database
inspection confirmed no sessions or refresh tokens remained. The harness's
initial nonzero exit reflected that redundant cleanup call, not a failed
functional check. Audit records and the synthetic receipt remain for review as
approved.

## Remaining limits

`app.tshelo.com` still returns 404 for receipt completion and is outside this
project's accessible domain scope. Mobile configuration still uses that hostname.
Its owner or correct replacement hostname is needed to finish that release path.
No native/store/OTA release, device test, SMS or push delivery was verified.
No provider-backed payout ownership verification was added. The payment test
proved a database owner notice, not receipt of a device notification.

Source changes and this evidence remain local/uncommitted; the production build
is reproducible from the base commit and patch recorded in the
[deployment report](web-release-deployment-2026-10-16.md).
