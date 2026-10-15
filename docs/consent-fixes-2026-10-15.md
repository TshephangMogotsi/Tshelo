# Consent audit and withdrawal fixes — 15 October 2026

Migration: `20261015220000_fix_consent_audit_and_withdrawal.sql`.
Linked production project: Tshelo (`albihofmlafjzbusancu`).

## Behaviour

1. **First processing acceptance is recorded.** An explicit acceptance creates
   a `data_processing / granted` event and server timestamp even when a legacy
   profile already has a true flag without audit history. The event records the
   supplied or already stored privacy-policy version. A new-policy acceptance
   is recorded too. Repeating an unchanged processing decision does not duplicate
   transition events.
2. **Channel changes are recorded independently.** Audit types
   `marketing_email`, `marketing_sms` and `marketing_push` record effective
   channel grants/withdrawals even when the aggregate marketing boolean stays
   true. Existing `marketing` events continue to record aggregate decisions.
3. **Overall withdrawal disables every channel.** `marketing_consent:false`
   clears email, SMS and push, clears the aggregate grant timestamp and logs the
   aggregate withdrawal plus changed channels. Withdrawal wins over conflicting
   channel-true values in the same request. A channel-only patch that disables
   the last enabled channel also clears aggregate consent. Enabling one channel
   enables aggregate consent without silently enabling other channels.

New profiles now default `data_processing_consent` to false. Existing profile
flags and historical timestamps are not rewritten. The migration does not
backfill audit events or invent past acceptance. Only a subsequent explicit
request creates an event at the current server time.

## Input and access boundaries

The routine requires an authenticated user identity, locks only that caller's
non-deleted profile, rejects unknown fields/client timestamps/user IDs, requires
actual JSON booleans, and rejects blank/null/non-string/oversized policy versions.
Processing grants require a known supplied/stored privacy version; withdrawals
are allowed without accepting a policy. Current registration callers already
supply privacy version `1.0` with processing acceptance.

Audit timestamps remain server-owned. Direct client audit INSERT/UPDATE/DELETE
privileges remain revoked; the obsolete INSERT policy was removed. Owner-only
reads remain in place. The routine remains SECURITY DEFINER with a pinned search
path and is not executable by anonymous callers. The profile-row lock serializes
first-event checks and state changes for a caller.

## Verification

- The real migration and SQL checks passed in disposable PostgreSQL (PGlite)
  through `npm run test:consent-security`.
- Before deployment, the migration plus the complete SQL checks passed on the
  linked database inside a transaction that rolled back the migration and all
  fixtures.
- Dry run listed exactly this one pending migration, which was then applied.
- The same strict SQL test passed after deployment against the live database.
  Every synthetic profile and audit entry was rolled back before PASS returned.
- A separate query confirmed the migration record, false default, zero remaining
  fixture profiles/audit rows, denied anonymous execution and denied client audit
  INSERT/UPDATE. The real consent log remains empty; this migration did not
  manufacture historical acceptance records.
- Before committing, compared the migration's consent function body with live
  PostgreSQL `prosrc`; they matched exactly and the migration record was present.
  The regression also passed from an isolated copy of the staged test, migration,
  baseline and SQL fixture, independently of unrelated worktree source changes.

Coverage includes legacy true-default first acceptance, new false-default
profiles, server timestamps, policy versions, repeated decisions, processing
withdrawal/regrant, channel-only email/SMS/push changes, overall withdrawal,
contradictory flags, disabling the last channel, empty patches, 13 invalid input
cases, denied direct audit/timestamp writes, cross-user reads, deleted profiles,
missing identity and anonymous execution.

The npm verification chain includes the local regression. The migrated disposable
Supabase CI job also runs `supabase/tests/consent_audit.sql`; that Docker-based
CI job was not run locally. No app/web release was triggered.

Repeat the live database check:

```sh
supabase db query --linked --file supabase/tests/consent_audit.sql --output json
```

This fixes the database routine. The held web/mobile rollout and a real
registration/preferences round trip remain open; existing historical consent
cannot be reconstructed from this fix. The earlier verification is preserved as
a [before-fix snapshot](membership-consent-verification-2026-10-15.md).
