# Phase 1 security hardening — 12 October 2026

Scope: client creation of mobile-money verification rows, client SMS-log writes,
promo-code visibility, and live configuration/template review. Waitlist controls,
membership recursion, MFA, encryption, leaked-password protection and default
table privileges remain separate follow-up work.

## Live review

Reviewed the linked project `albihofmlafjzbusancu`. Its 12 app-config rows contain
version/maintenance settings and operational limits: invite/report caps,
high-value approval thresholds, cooling-off and auto-close periods, and an AI
training reward cap. No credentials appeared in these values. All 20 notification
templates contain notification text and placeholders, with no credentials or
individual user data. The promo-code table currently has no rows.

No current mobile/web caller or public database function uses these five tables.
The Android SMS watcher is disabled and uses a notification RPC rather than
writing SMS logs. Provider-backed mobile-money verification and promo redemption
are not implemented; adding new RPCs would introduce unsupported product flows.

## Changes

- Revoke all client table privileges, then grant authenticated users read-only
  access to their own verification and SMS records through owner RLS policies.
- Remove verification/SMS insert policies. Only trusted servers create or change
  these records; verification status is never client-authored.
- Remove promo-code enumeration and notification-template reads from clients.
- Allow authenticated configuration reads only for the explicit version and
  maintenance keys, and only the `key` and `value` columns. New keys remain private.
- Preserve trusted service-role access and all existing records.
- Add a migration guard for effective client privileges, including column grants.

## Verification and rollout

`npm run test:phase-one-security` executes the actual migration in disposable
PostgreSQL (PGlite) using baseline table definitions and policies. It tests denied
client writes/truncation, denied anonymous access, owner-only reads, private and
future config keys, metadata restrictions, and preserved service-role writes.
The test runs in `npm run verify`.

Applied and verified on 12 October 2026: the migration record is present; client
table grants are limited to authenticated SELECT on the two owner-protected
tables; configuration column grants are limited to `key` and `value`; trusted
service-role access is preserved. A live query under the authenticated role
returned exactly the four approved version/maintenance settings.

Apply with `supabase db push --linked`, after checking the dry run includes only
`20261012120000_phase_one_client_table_hardening.sql`. Verify effective privileges,
RLS policies and the migration record afterward. No app or Edge Function release
is required for these restrictions.

Recovery: restore only a specifically justified grant or read policy after
investigating a demonstrated dependency. Do not restore the blanket client grants
or client-authored verification/SMS insert policies.
