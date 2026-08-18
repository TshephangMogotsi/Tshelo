import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('security hardening invariants', () => {
  const migration = read('supabase/migrations/20260722090000_security_hardening.sql')
  const pledgeMigration = read('supabase/migrations/20260722143000_pledge_tracking.sql')
  const eventFundMigration = read('supabase/migrations/20260722170000_event_fund_transaction_and_beta_tokens.sql')
  const smsIdempotencyMigration = read('supabase/migrations/20260722190000_sms_contribution_idempotency.sql')
  const eventDeletionMigration = read('supabase/migrations/20260722203000_event_only_deletion.sql')
  const pledgeNotificationMigration = read('supabase/migrations/20260722220000_pledge_member_notifications.sql')
  const contributorIdentityMigration = read('supabase/migrations/20260722230000_contributor_identity_and_pledge_allocations.sql')
  const richAuntieMigration = read('supabase/migrations/20260724120000_rich_auntie_sponsorship_flow.sql')
  const trustPointsMigration = read('supabase/migrations/20260812140100_separate_trust_points_from_tokens.sql')
  const eventJoinMigration = read('supabase/migrations/20260812150000_event_code_join.sql')
  const leaveMigration = read('supabase/migrations/20260812151000_leave_funds_and_events.sql')
  const customEventFundMigration = read('supabase/migrations/20260812152000_custom_event_fund_types.sql')
  const qualifiedEventFundMigration = read('supabase/migrations/20260812153000_qualify_event_fund_code.sql')
  const eventFundOwnerInsertFix = read('supabase/migrations/20260812154000_remove_redundant_event_fund_owner_insert.sql')
  const granularAdminMigration = read('supabase/migrations/20260812155000_fund_admin_permission_foundation.sql')
  const granularEnforcementMigration = read('supabase/migrations/20260812160000_enforce_fund_admin_permissions.sql')
  const granularCleanupMigration = read('supabase/migrations/20260812170000_retire_legacy_fund_admin_authorization.sql')
  const betaGrantRetirementMigration = read('supabase/migrations/20260812180000_retire_beta_test_token_grant.sql')

  it('removes global fund discovery and direct member self-management', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Authenticated users can discover funds by share code"'
    )
    expect(migration).toContain('DROP POLICY IF EXISTS fund_members_update_related')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.join_fund_by_code')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.join_fund_by_code(text) TO authenticated')
  })

  it('removes client writes to server-owned profile and ledger fields', () => {
    expect(migration).toContain('REVOKE UPDATE ON TABLE public.users FROM anon, authenticated')
    expect(migration).not.toMatch(/GRANT UPDATE \([^)]*token_balance/s)
    expect(migration).not.toMatch(/GRANT UPDATE \([^)]*trust_score/s)
    expect(migration).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.token_transactions FROM anon, authenticated'
    )
  })

  it('does not contain a literal push webhook credential', () => {
    const sqlFiles = fs
      .readdirSync(path.join(root, 'supabase/migrations'))
      .filter(file => file.endsWith('.sql'))
      .map(file => read(`supabase/migrations/${file}`))
      .join('\n')

    expect(sqlFiles).not.toMatch(/x-webhook-secret[^\n]{0,80}[0-9a-f]{32,}/i)
    expect(migration).toContain('DROP TRIGGER IF EXISTS "send-push"')
  })

  it('makes receipt storage private and rate limits parsing', () => {
    expect(migration).toContain("VALUES ('receipts', 'receipts', false")
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.begin_receipt_parse')
    expect(migration).toContain('hourly_count >= 10 OR daily_count >= 50')
  })

  it('makes the push function fail closed', () => {
    const sendPush = read('supabase/functions/send-push/index.ts')
    expect(sendPush).toContain("if (!EXPECTED_SECRET) return new Response")
    expect(sendPush).toContain("payload.table !== 'notifications'")
  })

  it('routes mobile joins through the authorized RPC', () => {
    const joinScreen = read('screens/main/JoinFundScreen.tsx')
    const fundApi = read('admin/lib/data/api-funds.ts')
    expect(joinScreen).toContain('api.funds.join(')
    expect(fundApi).toContain(".rpc('join_fund_by_code'")
    expect(joinScreen).not.toContain(".from('fund_members')\n      .insert")
    expect(migration).toContain("substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)")
    expect(joinScreen).toContain('maxLength={32}')
  })

  it('joins events as guests without granting linked-fund membership', () => {
    const joinScreen = read('screens/main/JoinEventScreen.tsx')
    const homeLoader = read('screens/main/home/loadHomeItems.ts')

    expect(eventJoinMigration).toContain('CREATE OR REPLACE FUNCTION public.find_event_by_code')
    expect(eventJoinMigration).toContain('CREATE OR REPLACE FUNCTION public.join_event_by_code')
    expect(eventJoinMigration).toContain("'yes'::public.rsvp_status")
    expect(eventJoinMigration).toContain("invitation_channel")
    expect(eventJoinMigration).not.toContain('INSERT INTO public.fund_members')
    expect(eventJoinMigration).toContain('GRANT EXECUTE ON FUNCTION public.join_event_by_code(text) TO authenticated, service_role')
    expect(eventJoinMigration).toContain("substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)")
    expect(joinScreen).toContain(".rpc('find_event_by_code'")
    expect(joinScreen).toContain(".rpc('join_event_by_code'")
    expect(joinScreen).not.toContain(".from('event_guests')")
    expect(homeLoader).toContain('api.home.summary')
    expect(read('admin/lib/data/api-funds.ts')).toContain("from('event_guests')")
  })

  it('lets non-owners leave funds and non-creators leave events without crossing access boundaries', () => {
    const fundScreen = read('screens/main/FundDetailScreen.tsx')
    const fundApi = read('admin/lib/data/api-funds.ts')
    const eventScreen = read('screens/main/EventDetailScreen.tsx')

    expect(leaveMigration).toContain('CREATE OR REPLACE FUNCTION public.leave_fund')
    expect(leaveMigration).toContain('CREATE OR REPLACE FUNCTION public.leave_event')
    expect(leaveMigration).toContain("target.owner_id = caller_id")
    expect(leaveMigration).toContain("target.creator_id = caller_id")
    expect(leaveMigration).toContain("status = 'left'::public.member_status")
    expect(leaveMigration).toContain('DELETE FROM public.event_guests')
    expect(leaveMigration).not.toContain('DELETE FROM public.fund_members')
    expect(leaveMigration).not.toContain('DELETE FROM public.funds')
    expect(leaveMigration).not.toContain('DELETE FROM public.events')
    expect(leaveMigration).toContain('GRANT EXECUTE ON FUNCTION public.leave_fund(uuid) TO authenticated, service_role')
    expect(fundScreen).toContain('api.funds.leave(')
    expect(fundApi).toContain(".rpc('leave_fund'")
    expect(leaveMigration).toContain('GRANT EXECUTE ON FUNCTION public.leave_event(uuid) TO authenticated, service_role')
    expect(eventScreen).toContain("supabase.rpc('leave_event'")
    expect(fundScreen).toContain('This will not remove you from the linked event.')
    expect(eventScreen).toContain('This will not remove you from the linked contribution fund.')
  })

  it('allows members to pledge only for themselves while managers record receipts', () => {
    expect(pledgeMigration).toContain('user_id = auth.uid()')
    expect(pledgeMigration).toContain("status = 'pledged'::public.contribution_status")
    expect(pledgeMigration).toContain('pledged_amount = amount')
    expect(pledgeMigration).toContain("manager.role IN ('owner'::public.member_role, 'admin'::public.member_role)")
    expect(pledgeMigration).toContain('confirmed_by = auth.uid()')
  })

  it('notifies fund members with pledge-specific content when a pledge is created', () => {
    expect(pledgeNotificationMigration).toContain("NEW.status = 'pledged'::public.contribution_status")
    expect(pledgeNotificationMigration).not.toContain('public.fund_manager_ids(NEW.fund_id)')
    expect(pledgeNotificationMigration).toContain("'New pledge'")
    expect(pledgeNotificationMigration).toContain("'kind', 'pledge'")
    expect(pledgeNotificationMigration).toContain('public.fund_member_user_ids(NEW.fund_id)')
  })

  it('separates contributor identity from membership and safely allocates unambiguous payments', () => {
    expect(contributorIdentityMigration).toContain('CREATE TABLE public.fund_contributors')
    expect(contributorIdentityMigration).toContain('never grants fund access')
    expect(contributorIdentityMigration).toContain('ALTER COLUMN contributor_id SET NOT NULL')
    expect(contributorIdentityMigration).toContain('CREATE TABLE public.pledge_allocations')
    expect(contributorIdentityMigration).toContain('open_pledge_count = 1')
    expect(contributorIdentityMigration).toContain('LEAST(NEW.amount, open_pledge_outstanding)')
    expect(contributorIdentityMigration).toContain('NEW.contributor_id IS DISTINCT FROM OLD.contributor_id')
    expect(contributorIdentityMigration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).*fund_contributors.*authenticated/i)

    const recordingScreen = read('screens/main/RecordContributionScreen.tsx')
    expect(recordingScreen).toContain('Add guest contributor?')
    expect(recordingScreen).toContain('This will not give them access to the fund.')
    expect(recordingScreen).toContain('Pledge matched automatically')
  })

  it('charges Event + Fund creation atomically in a server-owned ledger function', () => {
    expect(eventFundMigration).toContain('CREATE OR REPLACE FUNCTION public.create_event_fund')
    expect(eventFundMigration).toContain('FOR UPDATE')
    expect(eventFundMigration).toContain('current_balance < token_cost')
    expect(eventFundMigration).toContain("caller_id, -token_cost, 'spend', 'event_fund_creation'")
    expect(eventFundMigration).toContain('token_transaction_id, is_active')
    expect(eventFundMigration).toContain('REVOKE ALL ON FUNCTION public.create_event_fund')

    const createScreen = read('screens/main/CreateFundScreen.tsx')
    expect(createScreen).toContain(".rpc('create_event_fund'")
    expect(createScreen).toContain("error?.message.includes('INSUFFICIENT_TOKENS')")
  })

  it('accepts bounded custom Event + Fund types without weakening the paid transaction', () => {
    expect(customEventFundMigration).toContain('CREATE OR REPLACE FUNCTION public.create_event_fund')
    expect(customEventFundMigration).toContain("length(trim(coalesce(p_event_type, ''))) < 2")
    expect(customEventFundMigration).toContain('length(trim(p_event_type)) > 50')
    expect(customEventFundMigration).toContain("caller_id, -token_cost, 'spend', 'event_fund_creation'")
    expect(customEventFundMigration).toContain('FOR UPDATE')
    expect(customEventFundMigration).toContain('REVOKE ALL ON FUNCTION public.create_event_fund')
    expect(customEventFundMigration).not.toContain('Unsupported event type')
  })

  it('qualifies Event + Fund return columns that collide with output names', () => {
    expect(qualifiedEventFundMigration).toContain('INSERT INTO public.funds AS created_fund')
    expect(qualifiedEventFundMigration).toContain('RETURNING created_fund.id, created_fund.fund_code::text')
    expect(qualifiedEventFundMigration).not.toMatch(/RETURNING id, fund_code::text/)
  })

  it('relies on the atomic owner trigger instead of a conflicting duplicate membership insert', () => {
    expect(eventFundOwnerInsertFix).toContain('ensure_fund_owner_membership runs as a deferred constraint trigger')
    expect(eventFundOwnerInsertFix).not.toContain('ON CONFLICT (fund_id, user_id)')
    expect(eventFundOwnerInsertFix).not.toContain('INSERT INTO public.fund_members')
    expect(eventFundOwnerInsertFix).toContain('RETURNING created_fund.id, created_fund.fund_code::text')
    expect(eventFundOwnerInsertFix).toContain('RETURNING created_transaction.id INTO token_transaction_id')
  })

  it('makes granular admin grants owner-controlled, auditable, and backward compatible', () => {
    expect(granularAdminMigration).toContain('CREATE TABLE public.fund_permission_definitions')
    expect(granularAdminMigration).toContain('CREATE TABLE public.fund_admin_permissions')
    expect(granularAdminMigration).toContain('CREATE OR REPLACE FUNCTION public.has_fund_permission')
    expect(granularAdminMigration).toContain('CREATE OR REPLACE FUNCTION public.configure_fund_admin')
    expect(granularAdminMigration).toContain('CREATE OR REPLACE FUNCTION public.remove_fund_admin')
    expect(granularAdminMigration).toContain('Only the fund owner can configure admins')
    expect(granularAdminMigration).toContain("'permissions_changed'")
    expect(granularAdminMigration).toContain('Existing admins retain today\'s full operational access')
    expect(granularAdminMigration).toContain('CROSS JOIN public.fund_permission_definitions')
    expect(granularAdminMigration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).*fund_admin_permissions.*authenticated/i)
  })

  it('enforces granular permissions at each server-side operational boundary', () => {
    const requiredCapabilities = [
      'record_contributions',
      'edit_contributions',
      'record_expenses',
      'edit_expenses',
      'manage_members',
      'manage_sponsorships',
      'award_recognition',
      'export_reports',
      'manage_event_guests',
      'post_event_announcements',
      'manage_event_budget',
    ]

    requiredCapabilities.forEach(capability => {
      expect(granularEnforcementMigration).toContain(`'${capability}'`)
    })
    expect(granularEnforcementMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.has_linked_event_fund_permission'
    )
    expect(granularEnforcementMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.enforce_contribution_update_permission'
    )
    expect(granularEnforcementMigration).toContain(
      'Only the fund owner can record or change a refund'
    )
    expect(granularEnforcementMigration).toContain(
      'Recording received money requires record_contributions permission'
    )
    expect(granularEnforcementMigration).toContain(
      'Editing a contribution requires edit_contributions permission'
    )
    expect(granularEnforcementMigration).not.toMatch(
      /OR public\.is_fund_admin\s*\(/
    )
    expect(granularEnforcementMigration).not.toMatch(
      /role\s+IN\s*\([^)]*'admin'/i
    )
  })

  it('routes the owner-facing admin editor through audited permission RPCs', () => {
    const settings = read('screens/main/fundDetail/FundSettingsModal.tsx')
    const editor = read('screens/main/fundDetail/AdminPermissionEditorModal.tsx')
    const fundApi = read('admin/lib/data/api-funds.ts')

    expect(settings).toContain('api.funds.listAdminPermissions(')
    expect(fundApi).toContain(".rpc('get_fund_admin_permissions'")
    expect(settings).toContain('Admins & permissions')
    expect(settings).not.toMatch(/from\('fund_members'\)\.update/)
    expect(editor).toContain('api.funds.configureAdmin(')
    expect(editor).toContain('api.funds.removeAdmin(')
    expect(fundApi).toContain(".rpc('configure_fund_admin'")
    expect(fundApi).toContain(".rpc('remove_fund_admin'")
    expect(editor).toContain('FUND_PERMISSION_PRESETS.map')
    expect(editor).toContain('Custom permissions')
    expect(editor).toContain('They cannot manage admins')
  })

  it('loads effective capabilities once and gates client actions by exact permission', () => {
    const loader = read('lib/useFundPermissions.ts')
    const fundDetail = read('screens/main/FundDetailScreen.tsx')
    const contribution = read('screens/main/RecordContributionScreen.tsx')
    const expense = read('screens/main/RecordExpenseScreen.tsx')
    const recognition = read('screens/main/AwardRichAuntieScreen.tsx')
    const reports = read('screens/main/ReportsScreen.tsx')
    const eventDetail = read('screens/main/EventDetailScreen.tsx')
    const eventBudget = read('screens/main/EventBudgetScreen.tsx')
    const guestList = read('screens/main/GuestListScreen.tsx')
    const assignment = read('screens/main/AssignContributionScreen.tsx')
    const permissionPolicy = read('lib/fundPermissionPolicy.ts')
    const fundApi = read('admin/lib/data/api-funds.ts')

    expect(loader).toContain('api.funds.permissions(')
    expect(fundApi).toContain(".rpc('get_my_fund_permissions'")
    expect(fundApi).toContain('FUND_PERMISSION_KEYS')
    expect(fundDetail).toContain("can('record_contributions')")
    expect(fundDetail).toContain("can('edit_contributions')")
    expect(fundDetail).toContain("can('record_expenses')")
    expect(fundDetail).toContain("can('edit_expenses')")
    expect(fundDetail).toContain("can('manage_members')")
    expect(fundDetail).toContain("can('manage_sponsorships')")
    expect(fundDetail).toContain("can('award_recognition')")
    expect(fundDetail).toContain('canRefund={fund.owner_id === userId}')
    expect(contribution).toContain("can('record_contributions')")
    expect(expense).toContain("can('record_expenses')")
    expect(recognition).toContain("can('award_recognition')")
    expect(reports).toContain("can('export_reports')")
    expect(assignment).toContain("permissions.has('record_contributions')")
    expect(eventDetail).toContain('linkedEventCapabilities(isEventAdmin, linkedFundPermissions)')
    expect(permissionPolicy).toContain("permissions.has('manage_event_guests')")
    expect(permissionPolicy).toContain("permissions.has('post_event_announcements')")
    expect(permissionPolicy).toContain("permissions.has('manage_event_budget')")
    expect(eventBudget).toContain("permissions.has('manage_event_budget')")
    expect(guestList).toContain("permissions.has('manage_event_guests')")
    expect(fundDetail).not.toMatch(/role\s*===\s*['"]admin['"]/)
  })

  it('retires broad admin authorization while preserving relationship labels', () => {
    expect(granularCleanupMigration).toContain(
      'DROP POLICY IF EXISTS fund_members_select_related'
    )
    expect(granularCleanupMigration).toContain(
      "public.has_fund_permission(fund_id, 'manage_members')"
    )
    expect(granularCleanupMigration).toContain(
      "membership.status = 'joined'::public.member_status"
    )
    expect(granularCleanupMigration).toContain(
      "OR public.has_fund_permission(p_fund_id, 'manage_members')"
    )
    expect(granularCleanupMigration).toContain(
      'REVOKE ALL ON FUNCTION public.is_fund_admin(uuid)'
    )
    expect(granularCleanupMigration).toContain(
      'Operational authorization must use has_fund_permission'
    )
    expect(granularCleanupMigration).not.toContain(
      'OR public.is_fund_admin('
    )
  })

  it('keeps historical beta credits auditable but retires public claim access', () => {
    expect(eventFundMigration).toContain('CREATE TABLE public.beta_test_token_grants')
    expect(eventFundMigration).toContain('PRIMARY KEY REFERENCES public.users(id)')
    expect(eventFundMigration).toContain('CREATE OR REPLACE FUNCTION public.claim_beta_test_tokens')
    expect(betaGrantRetirementMigration).toContain(
      'REVOKE ALL ON FUNCTION public.claim_beta_test_tokens() FROM PUBLIC, anon, authenticated'
    )

    const tokenScreen = read('screens/main/TokenPurchaseScreen.tsx')
    expect(tokenScreen).not.toContain('claim_beta_test_tokens')
    expect(tokenScreen).not.toContain('beta_test_tokens_100')
  })

  it('keeps event-fund organizer access acceptance-based', () => {
    expect(eventFundMigration).toContain('CREATE OR REPLACE FUNCTION public.respond_to_event_fund_organiser_invite')
    expect(eventFundMigration).toContain("'admin'::public.member_role")
    expect(eventFundMigration).toContain("eo.status = 'pending'")
  })

  it('records each SMS-detected payment at most once and server-owns its notification state', () => {
    expect(smsIdempotencyMigration).toContain('contributions_source_detection_key_unique')
    expect(smsIdempotencyMigration).toContain('CREATE OR REPLACE FUNCTION public.record_detected_contribution')
    expect(smsIdempotencyMigration).toContain("SET response_action = 'recorded'")
    expect(smsIdempotencyMigration).toContain('EXCEPTION WHEN unique_violation')
    expect(smsIdempotencyMigration).toContain('CREATE OR REPLACE FUNCTION public.create_sms_detected_notification')
    expect(smsIdempotencyMigration).not.toMatch(/GRANT UPDATE \([^)]*response_action/s)

    const assignScreen = read('screens/main/AssignContributionScreen.tsx')
    expect(assignScreen).toContain('api.contributions.assignDetected(')
    expect(assignScreen).not.toContain(".from('contributions').insert")
  })

  it('deletes only standalone events and only through the creator-owned RPC', () => {
    expect(eventDeletionMigration).toContain('CREATE OR REPLACE FUNCTION public.delete_event_only')
    expect(eventDeletionMigration).toContain('event_row.creator_id <> caller_id')
    expect(eventDeletionMigration).toContain('event_row.linked_fund_id IS NOT NULL')
    expect(eventDeletionMigration).toContain('FROM public.event_fund_links link')
    expect(eventDeletionMigration).toContain('deleted_at IS NULL')

    const eventScreen = read('screens/main/EventDetailScreen.tsx')
    expect(eventScreen).toContain("supabase.rpc('delete_event_only'")
    expect(eventScreen).toContain('!event.linkedFundId && event.creatorId === userId')
  })

  it('keeps Rich Auntie sponsorship accounting and recognition server-validated', () => {
    expect(richAuntieMigration).toContain('WITH (security_invoker = true)')
    expect(richAuntieMigration).toContain('CREATE OR REPLACE FUNCTION public.claim_sponsorship_item')
    expect(richAuntieMigration).toContain("member.status = 'joined'::public.member_status")
    expect(richAuntieMigration).toContain('payment.user_id IS DISTINCT FROM item.claimed_by_user_id')
    expect(richAuntieMigration).toContain('already_allocated + NEW.amount > item.target_amount')
    expect(richAuntieMigration).toContain('expense.amount >= NEW.target_amount')
    expect(richAuntieMigration).toContain('recipient_user_id <> auth.uid()')
    expect(richAuntieMigration).toContain('IF NOT NEW.notify_member THEN')
  })

  it('keeps paid tokens separate from earned trust points', () => {
    expect(trustPointsMigration).toContain('ADD COLUMN trust_points_reward')
    expect(trustPointsMigration).toContain('ADD COLUMN trust_points_awarded')
    expect(trustPointsMigration).toContain('tokens_awarded,\n    trust_points_awarded')
    expect(trustPointsMigration).toContain("NEW.transaction_type <> 'purchase'")
    expect(trustPointsMigration).not.toContain('INSERT INTO public.token_transactions')

    const rewardSnackbar = read('components/RewardSnackbar.tsx')
    expect(rewardSnackbar).toContain('trust points earned')
    expect(rewardSnackbar).not.toContain('tokens earned')
  })
})
