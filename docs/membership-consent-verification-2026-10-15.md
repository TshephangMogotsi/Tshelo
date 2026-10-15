# Membership and consent verification — 15 October 2026

This is the before-fix snapshot. The three consent defects below were subsequently
fixed by `20261015220000` and regression-tested live on the same date; see
[consent fixes](consent-fixes-2026-10-15.md). The membership exceptions remain open.

Tested the live Tshelo database (`albihofmlafjzbusancu`) through the authenticated
database role with synthetic user JWT claims. No existing user's session or
personal records were used. All fixture work ran inside a subtransaction that
was deliberately rolled back before returning observations. This is database
verification, not an app/website end-to-end test. No policies or consent routines
were changed or deployed during this check.

## Membership results

| Session | Joined-only helper | Shared fund data | Insert vote/vouch/report | Fund row | Own membership row |
| --- | --- | --- | --- | --- | --- |
| joined | true | allowed | allowed | readable | readable |
| pending | false | denied | denied | readable | readable |
| left | false | denied | denied | denied | readable |
| unrelated user | false | denied | denied | denied | denied |

Shared reads covered 13 tables: `contribution_edits`, `contribution_reminders`,
`expense_edits`, `expense_queries`, `fund_announcements`, `fund_exports`,
`fund_milestones`, `fund_ownership_history`, `fund_shares`,
`fund_succession_requests`, `fund_succession_votes`, `rich_auntie_sponsorships`
and vouches between other users in `member_vouches`. This is 52 observed read
outcomes across four session states, plus 12 insert outcomes for succession
votes, member vouches and fund reports. Joined sessions were ordinary members,
not platform admins or fund owners. Successful insertion probes were rolled
back independently, so uniqueness constraints did not mask the positive checks.

The actual `leave_fund` RPC was also exercised: the membership row remained with
status `left`, the helper returned false immediately, and shared announcements
became inaccessible.

### Exceptions still present

1. A pending invitee can SELECT the fund row through existing permissive policies
   (`funds_select_member` and `Members and owners can read their funds`). This
   does not unlock the 13 shared-data tables above. Confirm the intended invite
   preview fields before certifying a blanket joined-only rule for `funds`.
2. `member_vouches` still permits a named voucher or recipient to read that row
   regardless of membership status. Both an authored vouch and a vouch about the
   caller remained readable after `leave_fund`. This does not meet the review's
   literal request for joined-only vouch reads, even though unrelated vouches
   are hidden. Tighten the policy or obtain an explicit product decision for
   continued personal-history access.
3. Own membership-row visibility remains available to pending/left users; this
   supports their membership status/history and does not itself grant fund data.

## Consent-log creation

`record_own_consents` successfully created these fixture events:

| Action tested | Observed log entries |
| --- | --- |
| Accept terms version `verify-1` | one `terms / accepted` |
| Accept privacy version `verify-1` | one `privacy / accepted` |
| Withdraw processing consent, then grant it again | one `withdrawn`, one `granted` |
| Enable marketing, then disable aggregate and all channels | one `granted`, one `withdrawn` |

Terms/privacy profile timestamps matched the database's `now()`. Ordinary users
could not insert forged consent-log rows, update/delete audit entries or write
acceptance timestamps directly. A timestamp supplied to the consent RPC was
rejected with `CONSENT_INVALID`. Another user saw zero entries belonging to the
fixture profile; anonymous callers lack EXECUTE on the consent routine.

### Consent gaps observed before the follow-up fix

1. **Initial processing acceptance is not logged.** New profiles default
   `data_processing_consent` to true. Submitting true with first-time terms and
   privacy acceptance creates their two events but zero processing events,
   because the routine logs processing consent only when its boolean changes.
2. **Channel changes are not logged when aggregate consent stays true.** Switching
   email off and SMS on created zero additional entries. The aggregate marketing
   boolean stayed true, so the audit routine omitted the preference change.
3. **Aggregate withdrawal alone does not switch off enabled channels.** With SMS
   enabled, submitting only `marketing_consent:false` left both
   `marketing_consent:true` and `marketing_sms_enabled:true`. The routine ORs the
   requested aggregate value with retained channel flags. Submitting false for
   the aggregate and every channel does withdraw consent and logs it.

The real consent log had zero rows before and after these tests, while nine
profiles have terms timestamps and nine have privacy timestamps. Acceptance
metadata therefore exists on profiles, but not in the consent audit log.
A separate post-test query confirmed zero fixture profiles and zero fixture
funds remained. Synthetic test entries were rolled back; their successful
creation does not backfill historical consent
or prove the released registration flow is recording it. The source contains
the consent RPC integration, but the held web/mobile rollout still needs an
end-to-end check. Historical acceptance must not be invented or backdated.

## Reproduce

```sh
supabase db query --linked --file security/fixtures/transactional-membership-consent-verification.sql --output json
```

This is an observational verification script: inspect its JSON outcomes,
including the exceptions above. It is not a green certification of all requested
rules. `fixtures_rolled_back` must be true. The deliberately raised rollback
exception is caught inside the temporary function; other unexpected fixture
errors propagate and roll back the statement automatically.
