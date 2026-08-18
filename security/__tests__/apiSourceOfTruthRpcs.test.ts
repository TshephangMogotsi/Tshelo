import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260817140000_api_source_of_truth_rpcs.sql'),
  'utf8',
)
const adminGuard = fs.readFileSync(
  path.join(root, 'admin/lib/api/platform-admin.ts'),
  'utf8',
)

describe('API source-of-truth RPC boundaries', () => {
  it('creates standalone events and organiser invitations in one caller-owned transaction', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_standalone_event')
    expect(migration).toContain('caller_id uuid := auth.uid()')
    expect(migration).toContain('INSERT INTO public.events')
    expect(migration).toContain('INSERT INTO public.event_organisers')
    expect(migration).toContain('jsonb_array_length(p_organisers) > 20')
    expect(migration).toContain('TO authenticated')
  })

  it('locks the existing event before atomically creating and linking its fund', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_fund_for_existing_event')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('target_event.creator_id <> caller_id')
    expect(migration).toContain('INSERT INTO public.funds AS new_fund')
    expect(migration).toContain('UPDATE public.events AS event_row')
    expect(migration).toContain('INSERT INTO public.event_fund_links')
    expect(migration).toContain('This event already has a linked fund')
  })

  it('uses one closed role matrix for privileged platform operations', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.require_platform_admin_operation')
    expect(migration).toContain("WHEN 'support.update' THEN caller_role IN ('support', 'operations', 'super_admin')")
    expect(migration).toContain("WHEN 'users.moderate' THEN caller_role IN ('operations', 'super_admin')")
    expect(migration).toContain("WHEN 'funds.moderate' THEN caller_role IN ('operations', 'super_admin')")
    expect(migration).toContain("WHEN 'platform_admins.manage' THEN caller_role = 'super_admin'")
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')
  })

  it('updates support tickets and audits the same transaction', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.platform_admin_update_support_ticket')
    expect(migration).toContain("PERFORM public.require_platform_admin_operation('support.update')")
    expect(migration).toContain('UPDATE public.support_tickets AS ticket')
    expect(migration).toContain("'support_ticket.updated'")
    expect(migration).toContain('INSERT INTO public.platform_admin_audit_log')
  })

  it('moderates users and funds through role-checked audited transitions', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.platform_admin_moderate_user')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.platform_admin_moderate_fund')
    expect(migration).toContain("caller_role := public.require_platform_admin_operation('users.moderate')")
    expect(migration).toContain("PERFORM public.require_platform_admin_operation('funds.moderate')")
    expect(migration).toContain("p_action NOT IN ('flag', 'unflag', 'ban', 'unban')")
    expect(migration).toContain("p_action NOT IN ('activate', 'close')")
    expect(migration).not.toContain("to_jsonb(target_profile)")
  })

  it('prevents super-admin self-lockout and loss of the last active super admin', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.platform_admin_upsert')
    expect(migration).toContain('LOCK TABLE public.platform_admins IN SHARE ROW EXCLUSIVE MODE')
    expect(migration).toContain("p_user_id = caller_id AND (NOT next_active OR p_role <> 'super_admin')")
    expect(migration).toContain('At least one active super administrator must remain')
    expect(migration).toContain("'platform_admin.created'")
    expect(migration).toContain("'platform_admin.updated'")
  })

  it('does not expose privileged mutation RPCs to anonymous or service-role callers', () => {
    const privilegedGrants = migration
      .split('\n')
      .filter(line => line.includes('GRANT EXECUTE ON FUNCTION public.platform_admin_'))
      .join('\n')

    expect(privilegedGrants).not.toContain('anon')
    expect(privilegedGrants).not.toContain('service_role')
    expect(privilegedGrants).toContain('platform_admin_update_support_ticket')
    expect(privilegedGrants).toContain('platform_admin_moderate_user')
    expect(privilegedGrants).toContain('platform_admin_moderate_fund')
    expect(privilegedGrants).toContain('platform_admin_upsert')
  })

  it('invokes privileged RPCs with the caller token instead of a service-role secret', () => {
    expect(adminGuard).toContain('export async function withPlatformAdminOperation')
    expect(adminGuard).toContain('supabase: auth.supabase')
    expect(adminGuard).not.toContain('SUPABASE_SECRET_KEY')
    expect(adminGuard).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(adminGuard).not.toContain('createServiceRoleClient')
  })
})
