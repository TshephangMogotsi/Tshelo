# Phase 2 security implementation — 12 October 2026

## Deployed database changes

Three migrations are applied on project `albihofmlafjzbusancu`:

- `20261012140000`: nonrecursive organization and recurring-group membership policies.
- `20261012150000`: restricted application-role table defaults and future-table guard.
- `20261012160000`: private waitlist storage and controlled submission/rate-limit/cleanup RPCs.

Organizations, recurring groups and the waitlist were empty before deployment.
All existing public application tables already had RLS enabled.

Organization access now requires an active membership and active organization.
There is no separate organization-owner column: an owner/admin role must still
hold active membership. Recurring-group access permits the owner (even without a
membership row) or a joined member; pending, removed, declined and left members
do not gain access from that row. The owner alone may insert group members.
Anonymous users cannot execute the membership helpers. Helper lookup paths are
pinned and all affected read policies use the helpers without querying their
own protected membership tables.

`postgres` global and public-schema table defaults no longer grant client access.
Future tables require explicit privileges and RLS. The guard checks all public
tables for missing RLS and checks tables created after this migration for
structural privileges and client grants without matching RLS policies. It also
detects renewed client default grants for `postgres`. Existing table grants are
grandfathered, not certified by this future-table guard; policy quality and
intended columns still require migration review.

The guard runs in the permission-database CI job after all migrations and at the
end of the waitlist migration. Future deployment scripts should run:

```sql
SELECT public.assert_application_table_security();
```

**Remaining platform limitation:** the linked `postgres` role is not a member of
`supabase_admin`, whose public-schema defaults still grant anon/authenticated
privileges. No claim is made that these managed-role defaults were changed.
Create application tables as `postgres`. Have an authorized managed-role
administrator/Supabase support remove its client defaults, then verify them.
The intended command for that authorized role is:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
```

Check global defaults too before accepting the platform change. See
[PostgreSQL default-privilege behavior](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

## Waitlist implementation and activation

No app currently submits waitlist entries. Direct anonymous and authenticated
table reads/writes are now closed. The new public server endpoint is
`POST /api/country-waitlist`; it is implemented and tested but not deployed or
enabled in the web application as part of this database release.

The endpoint accepts `country_code` (three-letter code from the database),
optional `email` and `phone` (at least one), and `captcha_token`. It rejects extra
fields and request bodies over 4 KiB. The server normalizes email/country values.
The database validates country eligibility (registered, non-launch country),
email size/format and phone prefix/length. Phone format is international E.164.
Repeated contact/country submissions return the same generic acceptance response,
with unique indexes preventing duplicate rows and no contact overwrite.

Rate limiting is durable across server workers: 10 attempts per IP per hour and
3 per normalized contact per day, including failed CAPTCHA attempts. Email and
phone are counted separately when both are supplied. Raw IP addresses are not
stored; identities use a server-keyed HMAC. The route only trusts Vercel's
`x-vercel-forwarded-for` while running on Vercel, not arbitrary generic forwarding
headers. See [Vercel request headers](https://vercel.com/docs/headers/request-headers).

CAPTCHA uses server-validated Turnstile with the configured hostname and action
`country_waitlist`. No acceptance path bypasses token validation. See
[Cloudflare token validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Before public collection starts:

1. Use the approved **12-calendar-month** contact retention period. Contacts are
   removed sooner after launch notification, sign-up, or verified deletion request.
2. Configure a production Turnstile widget for the actual hostname. Store its
   secret as `WAITLIST_TURNSTILE_SECRET_KEY`; set `WAITLIST_TURNSTILE_HOSTNAME`.
3. Configure a strong server secret `WAITLIST_RATE_LIMIT_KEY`. Optionally set
   `WAITLIST_CLEANUP_SECRET` for the manual cleanup endpoint. Do not expose secrets
   to browsers or commit them.
4. Deploy the web/API code. Verify the dedicated database cleanup schedule
   and monitor its job results. The protected cleanup endpoint is an optional
   manual fallback; it does not need a second external schedule.
5. Add the CAPTCHA-enabled submission UI if product requirements call for one,
   show the collection purpose/retention notice, and test a real token end to end.
6. Set `WAITLIST_ENABLED=true` only after those checks pass.

The database provides `purge_expired_country_waitlist()` for trusted schedulers.
The follow-up migration enables pg_cron and schedules only the dedicated cleanup
job at 02:15 UTC (04:15 Botswana time) daily. Before enabling it, inspection
confirmed no existing cron job table; the historical reminder migration skipped
scheduling while the extension was absent. A contact's deletion request can be fulfilled by support
after verifying contact ownership, using server-only deletion; neither record
IDs nor contact-search endpoints are public.

Raw contact information is retained only for the requested launch notification;
referral source and client-supplied account identity are not accepted. Rate-limit
records expire with their hour/day window and are removed by the cleanup job.
Retention cleanup applies to live tables, not historical database backups.

## Verification

`npm run test:phase-two-security` executes baseline table shapes and policies,
then applies the real migrations in disposable PostgreSQL. It checks owner,
active, pending, former, removed, anonymous and cross-group access; owner inserts;
revocation after membership changes; denied direct waitlist access; validation,
normalization, duplicates, contact/IP limits, window resets and expiry cleanup;
new-table default grants and guard failures for missing RLS/unexpected grants.

Six API tests check the rollout gate, body/input limits, trusted IP headers,
hashed identifiers, rate limiting, CAPTCHA failure/hostname/action checks,
verifier outages, successful normalized submission and cleanup authentication.
Website/API TypeScript checks pass.

Live checks confirm all three migration records, closed waitlist client writes,
restricted helper execution, and the table-security guard. A temporary test table
created as `postgres` received no automatic anon/authenticated grants; its entire
transaction was rolled back. No production contact/member fixtures were created.
Live CAPTCHA and managed-admin-default changes remain pending. The cleanup job
is configured by `20261012170000`; its actual first daily execution must be checked
in `cron.job_run_details` after 04:15 Botswana time.

Production configuration check: the confirmed Vercel project is
`diginav/tshelo-admin`. It has Supabase configuration but no `WAITLIST_*` variables
or CAPTCHA key. Keep public collection disabled until a production Turnstile
widget and secret are configured. Never use a CAPTCHA test key in production.

The approved retention migration `20261012170000` is deployed. Live verification
confirmed the 12-month default and exactly one active cron job, the dedicated
waitlist cleanup at 04:15 Botswana time daily. A direct cleanup invocation passed;
the table remains empty. Production Vercel configuration explicitly contains
`WAITLIST_ENABLED=false`. This is a configuration change for subsequent builds;
the waitlist API has not been deployed or enabled.
