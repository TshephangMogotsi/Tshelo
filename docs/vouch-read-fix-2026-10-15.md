# Joined-only vouch reads — 15 October 2026

Project: Tshelo (`albihofmlafjzbusancu`), production.
Migration: `20261015230000_require_joined_membership_for_vouch_reads.sql`.

## Change

`member_vouches.vouches_select` now permits authenticated SELECT only when
`public.is_fund_member(fund_id)` is true. The deployed helper checks the caller's
membership status is `joined`. Being the author or recipient no longer grants
read access independently of membership. Vouch records are retained; a joined
member can still read the fund's vouches, and trusted backend reads remain
available. The existing joined-only INSERT policy was not changed.

## Verification

The local PostgreSQL regression first confirmed that its checks fail under the
old author/recipient exception, then passed after applying the real migration.
Before deployment, the policy migration plus full test also passed on the linked
database inside a transaction that rolled back the policy and all fixtures.
The dry run listed only this migration. It was applied, and the complete test
passed again against the deployed policy.

| Membership state | Author | Recipient | Other member |
| --- | --- | --- | --- |
| joined | readable | readable | readable |
| pending | denied | denied | denied |
| left | denied | denied | denied |
| removed | denied | denied | denied |
| declined | denied | denied | denied |
| no membership | denied | denied | denied |

All 18 cases passed. Each also checked an unrelated fund containing a historical
vouch naming the same author/recipient; that fund's vouch remained hidden even
when the caller was joined to the primary test fund.

The actual `leave_fund` RPC was exercised independently for the author and the
recipient. Both could read before leaving, retained a membership row with status
`left` afterward, and immediately lost access to both test funds' vouches.
Anonymous reads were denied and service-role reads remained available.

A separate post-test catalog query confirmed the migration record, exactly one
SELECT/ALL policy with predicate `is_fund_member(fund_id)`, and zero remaining
fixture profiles or vouches.

All five synthetic profiles, both funds, memberships and vouches were rolled
back before the PASS summary was returned. No real user's membership or vouch
data was read, modified or deleted. No app/web deployment was required or run.

Repeat the checks:

```sh
npm run test:vouch-membership
supabase db query --linked --file supabase/tests/vouch_membership.sql --output json
```

The npm verification chain includes the local test. The disposable Supabase CI
job runs the SQL check after migrations; that Docker-based CI job was not run
locally. This resolves the personal-vouch read exception identified in
[the earlier verification](membership-consent-verification-2026-10-15.md).
Pending-invite fund-row visibility remains a separate open decision.
