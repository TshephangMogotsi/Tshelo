# Granular admin rollout

## Deployment order

1. Confirm migrations through `20260812160000` are present in the target.
2. Run the disposable database permission matrix in CI.
3. Deploy `20260812170000_retire_legacy_fund_admin_authorization.sql`.
4. Release the capability-aware client only after the migration succeeds.
5. Keep the compatibility trigger for one release cycle so older clients that
   promote an admin still grant the former full operational set atomically.
6. After the supported-client window closes, remove the compatibility trigger
   in a separate reviewed migration.

## Smoke-test accounts

Use a non-production staging fund with these accounts:

| Account | Grants | Expected result |
| --- | --- | --- |
| Owner | Implicit full catalogue | All operations and admin editor |
| Contributions assistant | `record_contributions` | Record received money; no edits or expenses |
| Expense assistant | `record_expenses` | Add expenses; no edits or contributions |
| Member coordinator | `manage_members` | Invite and action pending members only |
| Event coordinator | Three linked-event grants | Guests, announcements, and budget only |
| Ordinary member | None | View joined directory and make own pledge |

Also revoke one grant while the user is on the fund screen. On refocus, the
action must disappear immediately and a direct write must still be rejected by
the database.

## Audit review

Review permission changes for unexpected actors or unusually broad grants:

```sql
select
  audit.created_at,
  audit.fund_id,
  audit.user_id as changed_by,
  audit.entity_id as membership_id,
  audit.old_values,
  audit.new_values
from public.audit_log as audit
where audit.action = 'permissions_changed'
  and audit.created_at >= now() - interval '7 days'
order by audit.created_at desc;
```

Find admins whose effective grant count changed from the full catalogue:

```sql
select
  membership.fund_id,
  membership.user_id,
  count(grant_row.permission_key)
    filter (where definition.is_active) as grant_count,
  count(*) filter (where definition.is_active) as active_catalogue_count
from public.fund_members as membership
cross join public.fund_permission_definitions as definition
left join public.fund_admin_permissions as grant_row
  on grant_row.fund_id = membership.fund_id
 and grant_row.user_id = membership.user_id
 and grant_row.permission_key = definition.permission_key
where membership.role = 'admin'
  and membership.status = 'joined'
group by membership.fund_id, membership.user_id
having count(grant_row.permission_key) filter (where definition.is_active)
  <> count(*) filter (where definition.is_active)
order by membership.fund_id, membership.user_id;
```

Custom grants are expected after rollout; this query is for reviewing them,
not automatically repairing them.

## Rollback posture

Do not remove grant rows during an application rollback. An older supported
client can continue to operate because existing admins were backfilled and the
compatibility trigger still grants the full catalogue for legacy promotions.
If the new client must be rolled back, leave the database migrations in place
and redeploy the previous client build.
