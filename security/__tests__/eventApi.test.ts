import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('event API slice', () => {
  const contracts = read('shared/contracts/events.ts')
  const client = read('shared/api-client/client.ts')
  const data = read('admin/lib/data/api-events.ts')
  const validation = read('admin/lib/api/validation.ts')
  const screens = [
    'screens/main/CreateFundScreen.tsx',
    'screens/main/EventDetailScreen.tsx',
    'screens/main/EventBudgetScreen.tsx',
    'screens/main/GuestListScreen.tsx',
    'screens/main/JoinEventScreen.tsx',
  ]
  const mutationRoutes = [
    'admin/app/api/v1/events/[eventId]/route.ts',
    'admin/app/api/v1/events/[eventId]/leave/route.ts',
    'admin/app/api/v1/events/[eventId]/complete/route.ts',
    'admin/app/api/v1/events/[eventId]/budget/route.ts',
    'admin/app/api/v1/events/[eventId]/announcements/route.ts',
    'admin/app/api/v1/events/[eventId]/organiser-invites/route.ts',
    'admin/app/api/v1/events/join/route.ts',
    'admin/app/api/v1/events/event-funds/route.ts',
  ].map(read)

  it('publishes typed event workspace and mutation contracts', () => {
    for (const contract of [
      'EventWorkspace', 'EventInvitePreview', 'CreatedEventFund', 'JoinedEvent',
      'LeftEvent', 'EventBudget', 'EventAnnouncement', 'EventCapabilities',
    ]) expect(contracts).toContain(`type ${contract}`)
  })

  it('exposes every event operation through the shared client', () => {
    for (const method of [
      'createFund(', 'update(', 'remove(', 'workspace(', 'previewInvite(', 'join(',
      'leave(', 'complete(', 'budget(', 'updateBudget(', 'createAnnouncement(',
      'inviteOrganiser(',
    ]) expect(client).toContain(method)
  })

  it('authenticates mutation routes before reading bodies or path parameters', () => {
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

  it('uses caller-scoped services and preserves database business-rule RPCs', () => {
    for (const rpc of [
      'delete_event_only', 'leave_event', 'find_event_by_code', 'join_event_by_code',
      'create_event_fund', 'invite_event_fund_organiser', 'get_my_fund_permissions',
    ]) expect(data).toContain(`'${rpc}'`)
    expect(data).not.toContain('service_role')
    expect(data).not.toContain('createClient(')
  })

  it('strictly validates event writes, money, codes, and organiser phones', () => {
    for (const validator of [
      'validateJoinEventRequest', 'validateCreateEventFundRequest',
      'validateUpdateEventRequest', 'validateCompleteEventRequest',
      'validateUpdateEventBudgetRequest', 'validateCreateEventAnnouncementRequest',
      'validateInviteEventOrganiserRequest',
    ]) expect(validation).toContain(validator)
    expect(validation).toContain('PHONE_PATTERN')
    expect(validation).toContain('MONEY_PATTERN')
  })

  it('removes direct Supabase data access from every migrated event screen', () => {
    for (const file of screens) {
      const source = read(file)
      expect({ file, importsApi: source.includes("from '../../lib/api'") })
        .toEqual({ file, importsApi: true })
      expect({ file, directData: /\bsupabase\s*\.\s*(?:from|rpc|functions|storage)\b/.test(source) })
        .toEqual({ file, directData: false })
    }
  })
})
