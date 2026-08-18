import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('profile, notification, and reward API slice', () => {
  const accountData = read('admin/lib/data/api-account.ts')
  const client = read('shared/api-client/client.ts')
  const validation = read('admin/lib/api/validation.ts')
  const query = read('admin/lib/api/query.ts')
  const connectionSearchFix = read(
    'supabase/migrations/20260818130000_fix_connection_search_order.sql',
  )

  const mutationRoutes = [
    'admin/app/api/v1/users/me/route.ts',
    'admin/app/api/v1/notifications/route.ts',
    'admin/app/api/v1/events/organiser-invites/respond/route.ts',
    'admin/app/api/v1/events/organiser-invites/sync/route.ts',
    'admin/app/api/v1/rewards/evaluate/route.ts',
    'admin/app/api/v1/rewards/[rewardId]/seen/route.ts',
  ].map(read)

  it('authenticates before parsing bodies or path parameters', () => {
    for (const route of mutationRoutes) {
      const authentication = route.indexOf('authenticateApiRequest(request)')
      expect(authentication).toBeGreaterThan(-1)
      const bodyRead = route.indexOf('readValidatedJson(request')
      if (bodyRead >= 0) expect(authentication).toBeLessThan(bodyRead)
      const paramsRead = route.indexOf('await params')
      if (paramsRead >= 0) expect(authentication).toBeLessThan(paramsRead)
      expect(route).toContain("export const runtime = 'nodejs'")
    }
  })

  it('uses caller-scoped data functions and the existing business-rule RPCs', () => {
    for (const service of [
      'getApiCurrentUser', 'updateApiCurrentUser', 'searchApiConnections',
      'listApiNotifications', 'getApiNotification', 'markApiNotificationsRead',
      'syncApiOrganiserInvites', 'respondApiOrganiserInvite',
      'evaluateApiRewards', 'getApiRewardProgress', 'listApiUnseenRewards',
      'markApiRewardSeen',
    ]) expect(accountData).toContain(`export async function ${service}`)

    for (const rpc of [
      'search_my_connections', 'sync_my_event_fund_organiser_invites',
      'respond_to_event_fund_organiser_invite', 'evaluate_my_rewards',
      'get_my_reward_progress', 'mark_reward_snackbar_seen',
    ]) expect(accountData).toContain(rpc)

    expect(accountData).toContain(".eq('id', actorUserId)")
    expect(accountData).toContain(".eq('user_id', actorUserId)")
    expect(accountData).not.toContain('service_role')
    expect(accountData).not.toContain('createClient(')
  })

  it('strictly validates the new request and query contracts', () => {
    expect(validation).toContain('validateUpdateCurrentUserRequest')
    expect(validation).toContain('validateMarkNotificationsReadRequest')
    expect(validation).toContain('validateRespondOrganiserInviteRequest')
    expect(validation).toContain('empty_patch')
    expect(validation).toContain('Notification IDs must be unique.')
    expect(query).toContain('parseConnectionSearchQuery')
    expect(query).toContain('parseListNotificationsQuery')
    expect(query).toContain('Search text must contain between 2 and 100 characters.')
  })

  it('orders distinct connection results by the selected name output', () => {
    expect(connectionSearchFix).toContain('SELECT DISTINCT u.id, u.name::text, u.phone::text')
    expect(connectionSearchFix).toContain('ORDER BY 2')
    expect(connectionSearchFix).not.toContain('ORDER BY u.name')
  })

  it('exposes every operation through the shared typed client', () => {
    for (const method of [
      'updateMe(', 'searchConnections(', 'syncOrganiserInvites(',
      'respondOrganiserInvite(', 'markRead(', 'evaluate(', 'progress(',
      'listUnseen(', 'markSeen(',
    ]) expect(client).toContain(method)
  })

  it('removes direct Supabase data operations from migrated consumers', () => {
    const migrated = [
      'App.tsx', 'context/AuthContext.tsx', 'context/RewardsContext.tsx',
      'screens/auth/OTPScreen.tsx', 'screens/auth/ProfileSetupScreen.tsx',
      'screens/auth/RegistrationSuccessScreen.tsx', 'screens/main/ActivityScreen.tsx',
      'screens/main/NotificationsScreen.tsx', 'screens/main/ProfileScreen.tsx',
      'screens/main/RewardsScreen.tsx',
    ]
    for (const file of migrated) {
      expect({ file, directData: /\bsupabase\s*\.\s*(?:from|rpc|functions|storage)\b/.test(read(file)) })
        .toEqual({ file, directData: false })
    }
  })
})
