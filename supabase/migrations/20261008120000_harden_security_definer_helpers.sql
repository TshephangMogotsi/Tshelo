-- Harden application-owned SECURITY DEFINER helper functions.
--
-- Default PostgreSQL function privileges give PUBLIC (and therefore anon) EXECUTE.
-- These helpers run with elevated database privileges and must never be callable by
-- unauthenticated API clients. Future functions must receive an explicit grant.

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

-- Public-account closure is intentionally no longer a public RPC. The replacement
-- verification flow is introduced in 20261008110000_verify_public_account_closure_requests.sql.

-- Trigger and internal helpers: only server-side work may invoke them directly.
revoke execute on function public.auto_allocate_contribution_to_pledge() from public, anon, authenticated;
grant execute on function public.auto_allocate_contribution_to_pledge() to service_role;

revoke execute on function public.ensure_contribution_contributor() from public, anon, authenticated;
grant execute on function public.ensure_contribution_contributor() to service_role;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
grant execute on function public.handle_new_auth_user() to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

revoke execute on function public.log_contribution_changes() from public, anon, authenticated;
grant execute on function public.log_contribution_changes() to service_role;

revoke execute on function public.log_expense_changes() from public, anon, authenticated;
grant execute on function public.log_expense_changes() to service_role;

revoke execute on function public.log_expense_delete() from public, anon, authenticated;
grant execute on function public.log_expense_delete() to service_role;

revoke execute on function public.log_fund_changes() from public, anon, authenticated;
grant execute on function public.log_fund_changes() to service_role;

revoke execute on function public.log_fund_member_changes() from public, anon, authenticated;
grant execute on function public.log_fund_member_changes() to service_role;

revoke execute on function public.log_sponsorship_item_changes() from public, anon, authenticated;
grant execute on function public.log_sponsorship_item_changes() to service_role;

revoke execute on function public.notify_expense_insert() from public, anon, authenticated;
grant execute on function public.notify_expense_insert() to service_role;

revoke execute on function public.notify_fund_member_insert() from public, anon, authenticated;
grant execute on function public.notify_fund_member_insert() to service_role;

revoke execute on function public.notify_fund_member_update() from public, anon, authenticated;
grant execute on function public.notify_fund_member_update() to service_role;

revoke execute on function public.record_platform_admin_action(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_platform_admin_action(text, text, uuid, jsonb) to service_role;

revoke execute on function public.validate_pledge_allocation() from public, anon, authenticated;
grant execute on function public.validate_pledge_allocation() to service_role;

revoke execute on function public.submit_public_account_closure_request(text, text, text) from public, anon, authenticated;

-- RLS predicates: authenticated users need them for policy evaluation; anonymous
-- users do not. service_role is retained for trusted server-side administration.
revoke execute on function public.is_event_creator(uuid) from public, anon;
grant execute on function public.is_event_creator(uuid) to authenticated, service_role;

revoke execute on function public.is_event_guest(uuid) from public, anon;
grant execute on function public.is_event_guest(uuid) to authenticated, service_role;

revoke execute on function public.is_event_organiser(uuid) from public, anon;
grant execute on function public.is_event_organiser(uuid) to authenticated, service_role;

revoke execute on function public.is_fund_member(uuid) from public, anon;
grant execute on function public.is_fund_member(uuid) to authenticated, service_role;

revoke execute on function public.is_fund_owner(uuid) from public, anon;
grant execute on function public.is_fund_owner(uuid) to authenticated, service_role;

revoke execute on function public.is_platform_admin(text[]) from public, anon;
grant execute on function public.is_platform_admin(text[]) to authenticated, service_role;

-- Pin lookup order. API roles cannot CREATE in public, pg_catalog is first, and
-- pg_temp is explicitly last so a temporary object cannot shadow a trusted object.
alter function public.auto_allocate_contribution_to_pledge() set search_path to pg_catalog, public, pg_temp;
alter function public.ensure_contribution_contributor() set search_path to pg_catalog, public, pg_temp;
alter function public.handle_new_auth_user() set search_path to pg_catalog, public, pg_temp;
alter function public.handle_new_user() set search_path to pg_catalog, public, pg_temp;
alter function public.is_event_creator(uuid) set search_path to pg_catalog, public, pg_temp;
alter function public.is_event_guest(uuid) set search_path to pg_catalog, public, pg_temp;
alter function public.is_event_organiser(uuid) set search_path to pg_catalog, public, pg_temp;
alter function public.is_fund_member(uuid) set search_path to pg_catalog, public, pg_temp;
alter function public.is_fund_owner(uuid) set search_path to pg_catalog, public, pg_temp;
alter function public.is_platform_admin(text[]) set search_path to pg_catalog, public, pg_temp;
alter function public.log_contribution_changes() set search_path to pg_catalog, public, pg_temp;
alter function public.log_expense_changes() set search_path to pg_catalog, public, pg_temp;
alter function public.log_expense_delete() set search_path to pg_catalog, public, pg_temp;
alter function public.log_fund_changes() set search_path to pg_catalog, public, pg_temp;
alter function public.log_fund_member_changes() set search_path to pg_catalog, public, pg_temp;
alter function public.log_sponsorship_item_changes() set search_path to pg_catalog, public, pg_temp;
alter function public.notify_expense_insert() set search_path to pg_catalog, public, pg_temp;
alter function public.notify_fund_member_insert() set search_path to pg_catalog, public, pg_temp;
alter function public.notify_fund_member_update() set search_path to pg_catalog, public, pg_temp;
alter function public.record_platform_admin_action(text, text, uuid, jsonb) set search_path to pg_catalog, public, pg_temp;
alter function public.submit_public_account_closure_request(text, text, text) set search_path to pg_catalog, public, pg_temp;
alter function public.validate_pledge_allocation() set search_path to pg_catalog, public, pg_temp;

-- Deployment guard: no application SECURITY DEFINER helper may remain callable by anon.
do $$
declare
  exposed_helpers text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    into exposed_helpers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef
    and n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if exposed_helpers is not null then
    raise exception 'anon still has EXECUTE on SECURITY DEFINER helper(s): %', exposed_helpers;
  end if;
end;
$$;
