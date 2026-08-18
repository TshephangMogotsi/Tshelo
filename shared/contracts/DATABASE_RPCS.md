# Database RPC sources of truth

Status: 17 August 2026

This inventory defines where business rules live while the Tshelo API is introduced. An API route is an adapter: it authenticates the request, validates and maps the transport shape, calls the authoritative database operation, and maps the result into the shared response contract. It must not reproduce the SQL operation's authorization, state transitions, locking, idempotency, token accounting, or audit rules in TypeScript.

## Adapter rules

1. Call user-facing RPCs with the caller-scoped Supabase client returned by `authenticateApiRequest`. Even `SECURITY DEFINER` functions depend on the caller's verified `auth.uid()`.
2. Never pass a request-body user ID as the actor. Existing RPCs that use `auth.uid()` continue to derive identity from the Supabase JWT.
3. Do not replace an RPC with a sequence of `.from(...).insert/update/delete` calls. The sequence would lose the RPC's transaction, row locks, idempotency, and coordinated side effects.
4. The API may validate syntax and contract limits before calling SQL, but a duplicated API check is only an early error message. The database check remains authoritative.
5. Map expected PostgreSQL/RPC failures into the standard API error envelope. Do not expose raw SQL, table names, stack traces, or Supabase error details.
6. After a mutation, return the RPC result or re-read the public resource through the caller-scoped RLS client. Do not expose an unrestricted service-role row.
7. A migration that replaces a function becomes its new authoritative definition. The latest migration named below wins over the baseline dump.
8. Trigger functions and RLS helper functions are database internals. Route handlers benefit from them indirectly and should not expose them as arbitrary RPC endpoints.

## Funds and membership

| Product operation | Authoritative RPC | Latest definition | Rules retained in SQL |
| --- | --- | --- | --- |
| Discover a fund from an invite code | `find_fund_by_code(p_code)` | [`20260707053236_baseline.sql`](../../supabase/migrations/20260707053236_baseline.sql) with execution restricted by [`20260722090000_security_hardening.sql`](../../supabase/migrations/20260722090000_security_hardening.sql) | Exact code lookup and deliberately limited preview fields. |
| Read privacy during the code-join flow | `get_fund_privacy(p_fund_id)` | [`20260707053236_baseline.sql`](../../supabase/migrations/20260707053236_baseline.sql), restricted by [`20260722090000_security_hardening.sql`](../../supabase/migrations/20260722090000_security_hardening.sql) | Reveals only the privacy flag; it is not a general fund-detail bypass. |
| Join a fund by code | `join_fund_by_code(p_code)` | [`20260722090000_security_hardening.sql`](../../supabase/migrations/20260722090000_security_hardening.sql) | Authenticated actor, code normalization, active-fund check, owner/existing-membership rejection, private-fund pending state, row locking, and safe restoration of an old membership. `JoinFundRequest` must wrap this RPC. |
| Leave a fund | `leave_fund(p_fund_id)` | [`20260812151000_leave_funds_and_events.sql`](../../supabase/migrations/20260812151000_leave_funds_and_events.sql) | Non-owner rule, active membership locking, admin demotion, financial-history preservation, and the `left` transition. `LeaveFundRequest` must wrap this RPC. |
| Read the member directory | `get_fund_member_profiles(p_fund_id)` | [`20260812170000_retire_legacy_fund_admin_authorization.sql`](../../supabase/migrations/20260812170000_retire_legacy_fund_admin_authorization.sql) | Membership visibility, pending-member privacy, owner/member checks, and `manage_members` capability checks. |
| Read the caller's effective fund capabilities | `get_my_fund_permissions(p_fund_id)` | [`20260812155000_fund_admin_permission_foundation.sql`](../../supabase/migrations/20260812155000_fund_admin_permission_foundation.sql) | Owners receive the active catalogue; admins receive only active grants. |
| Read all configured fund admins as the owner | `get_fund_admin_permissions(p_fund_id)` | [`20260812155000_fund_admin_permission_foundation.sql`](../../supabase/migrations/20260812155000_fund_admin_permission_foundation.sql) | Owner-only visibility and current joined-admin filtering. |
| Promote/configure a fund admin | `configure_fund_admin(p_member_id, p_permissions)` | [`20260812155000_fund_admin_permission_foundation.sql`](../../supabase/migrations/20260812155000_fund_admin_permission_foundation.sql) | Owner authorization, joined-member requirement, permission validation, promotion, grant replacement, and audit insertion in one transaction. |
| Remove fund-admin access | `remove_fund_admin(p_member_id)` | [`20260812155000_fund_admin_permission_foundation.sql`](../../supabase/migrations/20260812155000_fund_admin_permission_foundation.sql) | Owner authorization, grant deletion, demotion, and audit insertion in one transaction. |
| Search safe prior connections | `search_my_connections(p_query)` | [`20260722170000_event_fund_transaction_and_beta_tokens.sql`](../../supabase/migrations/20260722170000_event_fund_transaction_and_beta_tokens.sql) | Query sanitization and relationship-scoped user discovery; the API must not replace it with a global users search. |

`has_fund_permission(p_fund_id, p_permission_key)` and `has_linked_event_fund_permission(p_event_id, p_permission_key)` are supporting authorization sources of truth. RLS policies and mutation RPCs call them. API code may use `get_my_fund_permissions` to describe UI capabilities, but successful client-side permission reads never replace database enforcement on a mutation.

## Events and Event + Fund

| Product operation | Authoritative RPC | Latest definition | Rules retained in SQL |
| --- | --- | --- | --- |
| Create a standalone event | `create_standalone_event(...)` | [`20260817140000_api_source_of_truth_rpcs.sql`](../../supabase/migrations/20260817140000_api_source_of_truth_rpcs.sql) | Authenticated actor, active-profile check, bounded event fields and organiser array, event creation, organiser matching/deduplication, and one transaction. `CreateEventRequest` wraps this RPC. |
| Create a fund for an existing event | `create_fund_for_existing_event(...)` | [`20260817140000_api_source_of_truth_rpcs.sql`](../../supabase/migrations/20260817140000_api_source_of_truth_rpcs.sql) | Event row lock, creator authorization, active/unlinked checks, matching currency, fund creation, owner-membership trigger, event update, and link-row creation in one transaction. This is distinct from the paid combined product. |
| Create the paid combined Event + Fund product | `create_event_fund(...)` | [`20260812154000_remove_redundant_event_fund_owner_insert.sql`](../../supabase/migrations/20260812154000_remove_redundant_event_fund_owner_insert.sql) | Input limits, actor derivation, token balance lock/debit, event and fund creation, generated codes, budget and links, organiser invitations, notification creation, and a single transaction. It is not interchangeable with standalone `CreateEventRequest` or `CreateFundRequest`. |
| Discover an event from a code | `find_event_by_code(p_code)` | [`20260812150000_event_code_join.sql`](../../supabase/migrations/20260812150000_event_code_join.sql) | Code normalization, limited preview fields, linked-fund indicator, and already-participating calculation. |
| Join an event by code | `join_event_by_code(p_code)` | [`20260812150000_event_code_join.sql`](../../supabase/migrations/20260812150000_event_code_join.sql) | Active-event checks, existing guest handling, phone-invite claiming, confirmed RSVP state, and the guarantee that joining an event never joins its linked fund. `JoinEventRequest` must wrap this RPC. |
| Leave an event | `leave_event(p_event_id)` | [`20260812151000_leave_funds_and_events.sql`](../../supabase/migrations/20260812151000_leave_funds_and_events.sql) | Creator exclusion, guest removal, organiser deactivation, row locking, and the separate Event/Fund membership model. `LeaveEventRequest` must wrap this RPC. |
| Delete a standalone event | `delete_event_only(p_event_id)` | [`20260722203000_event_only_deletion.sql`](../../supabase/migrations/20260722203000_event_only_deletion.sql) | Creator-only authorization, idempotent soft deletion, and rejection when an Event + Fund relationship exists. |
| Invite an Event + Fund organiser | `invite_event_fund_organiser(...)` | [`20260722170000_event_fund_transaction_and_beta_tokens.sql`](../../supabase/migrations/20260722170000_event_fund_transaction_and_beta_tokens.sql) | Creator/relationship checks, phone normalization, invite persistence, and notifications. |
| Claim pending organiser invites after sign-in | `sync_my_event_fund_organiser_invites()` | [`20260722170000_event_fund_transaction_and_beta_tokens.sql`](../../supabase/migrations/20260722170000_event_fund_transaction_and_beta_tokens.sql) | Matches the authenticated profile phone, links previously phone-only invites, and avoids duplicate notifications. |
| Accept or decline an Event + Fund organiser invite | `respond_to_event_fund_organiser_invite(p_invite_id, p_accept)` | [`20260722170000_event_fund_transaction_and_beta_tokens.sql`](../../supabase/migrations/20260722170000_event_fund_transaction_and_beta_tokens.sql) | Invite ownership, state locking, organiser transition, linked fund-admin membership, and notification response state in one transaction. |

## Contributions, SMS detection, and receipts

| Product operation | Authoritative RPC | Latest definition | Rules retained in SQL |
| --- | --- | --- | --- |
| Persist a device-detected SMS payment notification | `create_sms_detected_notification(p_detected)` | [`20260722190000_sms_contribution_idempotency.sql`](../../supabase/migrations/20260722190000_sms_contribution_idempotency.sql) | Actor derivation, payload cleaning, amount/provider validation, stable detection keys, duplicate suppression, and server-owned notification fields. |
| Assign a detected payment to a fund | `record_detected_contribution(p_fund_id, p_detected, p_notification_id)` | [`20260812160000_enforce_fund_admin_permissions.sql`](../../supabase/migrations/20260812160000_enforce_fund_admin_permissions.sql) | `record_contributions` capability, active-fund check, notification ownership, amount validation, idempotency, contribution creation, and notification update in one transaction. The API must never reproduce the detection-key logic. |
| Begin receipt parsing | `begin_receipt_parse(p_fund_id)` | [`20260812160000_enforce_fund_admin_permissions.sql`](../../supabase/migrations/20260812160000_enforce_fund_admin_permissions.sql) | `record_expenses` permission and per-user/fund parsing limits before the receipt Edge Function does work. |

Manual contribution insert/update/refund currently uses RLS plus the `enforce_contribution_update_permission`, `enforce_financial_row_identity`, contributor-linking, pledge-allocation, and audit triggers. There is no dedicated manual-contribution mutation RPC yet. API handlers may issue one caller-scoped table mutation and let those database rules execute; they must not calculate permissions or controlled identity/audit fields themselves.

## Sponsorship and rewards

| Product operation | Authoritative RPC | Latest definition | Rules retained in SQL |
| --- | --- | --- | --- |
| Claim a sponsorship item | `claim_sponsorship_item(p_item_id)` | [`20260724120000_rich_auntie_sponsorship_flow.sql`](../../supabase/migrations/20260724120000_rich_auntie_sponsorship_flow.sql) | Authenticated joined member, active fund, open-item transition, and atomic winner selection. |
| Release a sponsorship claim | `release_sponsorship_item(p_item_id)` | [`20260812160000_enforce_fund_admin_permissions.sql`](../../supabase/migrations/20260812160000_enforce_fund_admin_permissions.sql) | Claim ownership or `manage_sponsorships`, plus rejection after contribution allocation. |
| Evaluate the caller's rewards/trust | `evaluate_my_rewards()` | [`20260812140100_separate_trust_points_from_tokens.sql`](../../supabase/migrations/20260812140100_separate_trust_points_from_tokens.sql) | Actor-scoped reward evaluation and trust refresh. The API does not recalculate thresholds. |
| Read reward progress | `get_my_reward_progress()` | [`20260812140100_separate_trust_points_from_tokens.sql`](../../supabase/migrations/20260812140100_separate_trust_points_from_tokens.sql) | Current metrics, thresholds, earned state, and trust-point rewards. |
| Mark a reward message seen | `mark_reward_snackbar_seen(p_reward_id)` | [`20260811110100_rewards_foundation.sql`](../../supabase/migrations/20260811110100_rewards_foundation.sql) | Caller ownership and idempotent timestamping. |

`claim_beta_test_tokens()` is retired for authenticated clients by [`20260812180000_retire_beta_test_token_grant.sql`](../../supabase/migrations/20260812180000_retire_beta_test_token_grant.sql). It must not be exposed by the production API.

## Platform administration

| Product operation | Authoritative RPC/helper | Latest definition | API treatment |
| --- | --- | --- | --- |
| Check platform-admin membership or a required role set | `is_platform_admin(required_roles)` | [`20260814120000_platform_admin_console.sql`](../../supabase/migrations/20260814120000_platform_admin_console.sql) | Database source for the active allowlist. The API's narrower operation matrix adds application authorization; it does not weaken this check. |
| Record a platform-admin audit event | `record_platform_admin_action(action_name, target_type, target_id, action_metadata)` | [`20260814120000_platform_admin_console.sql`](../../supabase/migrations/20260814120000_platform_admin_console.sql) | Call with the authenticated admin's caller-scoped client so `auth.uid()` records the real actor. Never pass an actor ID from the request and never call it with only a service-role identity. |
| Update a support ticket | `platform_admin_update_support_ticket(p_ticket_id, p_patch)` | [`20260817140000_api_source_of_truth_rpcs.sql`](../../supabase/migrations/20260817140000_api_source_of_truth_rpcs.sql) | `support`, `operations`, or `super_admin`; closed patch fields; row lock; resolution metadata; and platform audit in one transaction. |
| Moderate a user | `platform_admin_moderate_user(p_user_id, p_action, p_reason)` | [`20260817140000_api_source_of_truth_rpcs.sql`](../../supabase/migrations/20260817140000_api_source_of_truth_rpcs.sql) | `operations` or `super_admin`; safe flag/ban transitions, self-moderation rejection, active-admin protection, and a non-sensitive platform audit. |
| Moderate a fund | `platform_admin_moderate_fund(p_fund_id, p_action, p_reason)` | [`20260817140000_api_source_of_truth_rpcs.sql`](../../supabase/migrations/20260817140000_api_source_of_truth_rpcs.sql) | `operations` or `super_admin`; locked lifecycle transition, required reason, completed-fund protection, fund audit trigger, and platform audit. |
| Create or update a platform administrator | `platform_admin_upsert(p_user_id, p_role, p_status)` | [`20260817140000_api_source_of_truth_rpcs.sql`](../../supabase/migrations/20260817140000_api_source_of_truth_rpcs.sql) | `super_admin` only; target validation, banned-account rejection, serialized last-super-admin protection, self-lockout prevention, and platform audit. |

The four privileged mutation contracts now have operation-specific atomic RPCs. API handlers must use a caller-scoped client so these functions receive the verified `auth.uid()`. The internal `require_platform_admin_operation` helper is intentionally not executable by client roles and must not be surfaced as a route.

## Direct RLS operations that do not need an RPC

The following are intentionally ordinary caller-scoped queries unless a future workflow needs multiple atomic writes:

- list/detail reads for users, funds, contributions, events, support tickets, and audit history;
- the current user's profile update, with server-owned columns protected by `users_update_own`;
- single-row standalone fund/event updates covered by RLS and database triggers;
- manual contribution writes covered by contribution RLS and triggers;
- read-only platform console queries covered by `is_platform_admin()` RLS policies.

The API still owns transport concerns such as pagination, filters, money/date serialization, public field selection, and standardized errors. It does not own the underlying authorization or lifecycle rules.

## Remaining database-boundary reviews

The initial API blockers now have authoritative RPCs. Before later API phases expose additional write workflows, review whether manual contribution creation/editing/refunds and multi-row event/fund updates need purpose-specific transactional RPCs rather than their current single-table RLS-and-trigger paths. Do not turn a multi-query TypeScript workflow into the source of truth.

Legacy calculation helpers such as `get_fund_balance`, `get_fund_progress`, `get_fund_trust_badge`, and `get_user_trust_score` are not automatically approved public API boundaries. Review their current grants, caller visibility, and semantics before adopting them; prefer protected views or caller-scoped aggregate queries when no transactional rule is involved.
