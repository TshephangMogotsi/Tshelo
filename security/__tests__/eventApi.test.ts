import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('event API slice', () => {
  const contracts = read('shared/contracts/events.ts')
  const client = read('shared/api-client/client.ts')
  const data = read('admin/lib/data/api-events.ts')
  const validation = read('admin/lib/api/validation.ts')
  const guestMigration = read('supabase/migrations/20260902130000_event_guest_management.sql')
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
    'admin/app/api/v1/events/[eventId]/files/upload-session/route.ts',
    'admin/app/api/v1/events/[eventId]/files/finalize/route.ts',
    'admin/app/api/v1/events/[eventId]/files/[fileId]/access/route.ts',
    'admin/app/api/v1/events/[eventId]/files/[fileId]/route.ts',
    'admin/app/api/v1/events/[eventId]/guests/route.ts',
    'admin/app/api/v1/events/[eventId]/guests/[guestId]/route.ts',
    'admin/app/api/v1/events/[eventId]/rsvp/route.ts',
    'admin/app/api/v1/events/[eventId]/guest-capacity/route.ts',
    'admin/app/api/v1/events/[eventId]/organiser-invites/route.ts',
    'admin/app/api/v1/events/join/route.ts',
    'admin/app/api/v1/events/event-funds/route.ts',
  ].map(read)

  it('publishes typed event workspace and mutation contracts', () => {
    for (const contract of [
      'EventWorkspace', 'EventInvitePreview', 'CreatedEventFund', 'JoinedEvent',
      'LeftEvent', 'EventBudget', 'EventAnnouncement', 'EventCapabilities',
      'EventFile', 'EventFileUploadSession', 'EventFileAccess', 'FinalizeEventFileRequest',
      'EventGuestDirectory', 'EventGuestSummary', 'EventGuestCapacity',
      'InviteEventGuestsRequest', 'UpdateEventGuestRequest', 'RespondEventRsvpRequest',
    ]) expect(contracts).toContain(`type ${contract}`)
  })

  it('exposes every event operation through the shared client', () => {
    for (const method of [
      'createFund(', 'update(', 'remove(', 'workspace(', 'previewInvite(', 'join(',
      'leave(', 'complete(', 'budget(', 'updateBudget(', 'createAnnouncement(',
      'listGuests(', 'getGuest(', 'inviteGuests(', 'updateGuest(', 'removeGuest(',
      'myRsvp(', 'respondRsvp(', 'guestCapacity(', 'unlockGuestCapacity(', 'inviteOrganiser(',
      'createFileUploadSession(', 'finalizeFile(', 'createFileAccess(', 'removeFile(',
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
      'can_manage_event_guests', 'get_event_guest_overview', 'invite_event_guests',
      'update_event_guest', 'remove_event_guest', 'respond_event_rsvp',
      'unlock_event_guest_capacity',
    ]) expect(data).toContain(`'${rpc}'`)
    expect(data).not.toContain('service_role')
    expect(data).not.toContain('createClient(')
  })

  it('strictly validates event writes, money, codes, and organiser phones', () => {
    for (const validator of [
      'validateJoinEventRequest', 'validateCreateEventFundRequest',
      'validateUpdateEventRequest', 'validateCompleteEventRequest',
      'validateUpdateEventBudgetRequest', 'validateCreateEventAnnouncementRequest',
      'validateInviteEventOrganiserRequest', 'validateInviteEventGuestsRequest',
      'validateUpdateEventGuestRequest', 'validateRespondEventRsvpRequest',
      'validateCreateEventFileUploadSessionRequest', 'validateFinalizeEventFileRequest',
    ]) expect(validation).toContain(validator)
    expect(validation).toContain('PHONE_PATTERN')
    expect(validation).toContain('MONEY_PATTERN')
  })

  it('enforces guest management, RSVP ownership, and paid capacity in the database', () => {
    expect(guestMigration).toContain("'event_guests_above_100'")
    expect(guestMigration).toContain('CREATE TRIGGER enforce_event_guest_capacity')
    expect(guestMigration).toContain('CREATE OR REPLACE FUNCTION public.can_manage_event_guests')
    expect(guestMigration).toContain('CREATE OR REPLACE FUNCTION public.respond_event_rsvp')
    expect(guestMigration).toContain('CREATE OR REPLACE FUNCTION public.unlock_event_guest_capacity')
    expect(guestMigration).toContain('IF proposed_used > 100')
    expect(guestMigration).toContain('pass_unlimited_12m')
    expect(guestMigration).toContain('pass_committee_12m')
    expect(guestMigration).toContain('CREATE POLICY event_guests_update_manager')
    expect(guestMigration).toContain('CREATE POLICY event_guests_delete_manager')
    expect(guestMigration).toContain('REVOKE ALL ON FUNCTION public.respond_event_rsvp')
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

  it('keeps the website event flow behind the typed API boundary', () => {
    const homeSummaryCache = read('admin/lib/home-summary-cache.ts')
    const websiteFiles = [
      'admin/components/account-events/event-list.tsx',
      'admin/components/account-events/create-event-form.tsx',
      'admin/components/account-events/join-event-dialog.tsx',
      'admin/components/account-events/event-workspace.tsx',
      'admin/components/account-events/event-guests.tsx',
    ]

    for (const file of websiteFiles) {
      const source = read(file)
      const importsTypedBoundary = source.includes("from '@/lib/api-client'")
        || source.includes("from '@/lib/home-summary-cache'")
      expect({ file, importsTypedBoundary }).toEqual({ file, importsTypedBoundary: true })
      expect({ file, importsSupabase: /from\s+['"][^'"]*supabase['"]/.test(source) })
        .toEqual({ file, importsSupabase: false })
      expect({ file, directData: /\bsupabase\s*\.\s*(?:from|rpc|functions|storage)\b/.test(source) })
        .toEqual({ file, directData: false })
    }
    expect(homeSummaryCache).toContain("from '@/lib/api-client'")
  })

  it('provides organiser guest management and attendee RSVP views on the website', () => {
    const guestView = read('admin/components/account-events/event-guests.tsx')

    for (const operation of [
      'events.listGuests(', 'events.inviteGuests(', 'events.updateGuest(',
      'events.removeGuest(', 'events.myRsvp(', 'events.respondRsvp(',
      'events.unlockGuestCapacity(',
    ]) expect(guestView).toContain(operation)

    expect(guestView).toContain("linked_fund_permissions.includes('manage_event_guests')")
    expect(guestView).toContain('Invite guests and track every RSVP')
    expect(guestView).toContain('Your RSVP')
    expect(guestView).toContain('Copy invite link')
    expect(guestView).toContain('Search guests')
    expect(guestView).toContain('Filter by RSVP status')
    expect(guestView).toContain('Allowed plus-ones')
  })
})
