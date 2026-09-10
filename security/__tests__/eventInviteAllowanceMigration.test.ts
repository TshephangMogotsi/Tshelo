import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260909130000_event_invite_plus_one_preview.sql'), 'utf8')
const guestRules = fs.readFileSync(path.join(root, 'supabase/migrations/20260902130000_event_guest_management.sql'), 'utf8')
const contracts = fs.readFileSync(path.join(root, 'shared/contracts/events.ts'), 'utf8')
const joinDialog = fs.readFileSync(path.join(root, 'admin/components/account-events/join-event-dialog.tsx'), 'utf8')
const guestView = fs.readFileSync(path.join(root, 'admin/components/account-events/event-guests.tsx'), 'utf8')

describe('personal event invitation allowances', () => {
  it('returns only the authenticated invitee allowance and defaults general links to zero', () => {
    expect(migration).toContain('allowed_plus_ones integer')
    expect(migration).toContain('event_guest.user_id = caller_id')
    expect(migration).toContain('event_guest.user_id IS NULL')
    expect(migration).toContain('public.normalized_phone(event_guest.guest_phone) = caller_phone_normalized')
    expect(migration).toContain('), 0)::integer')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.find_event_by_code(text) FROM PUBLIC, anon')
  })

  it('publishes the allowance and keeps the database-backed RSVP mutation in the invite flow', () => {
    expect(contracts).toContain('allowed_plus_ones: number')
    expect(joinDialog).toContain('This invitation is for you and up to ${allowedPlusOnes} additional guests.')
    expect(joinDialog).toContain('events.respondRsvp(preview.id')
    expect(joinDialog).toContain('Array.from({ length: allowedPlusOnes + 1 }')
    expect(guestView).toContain('You can add no more than')
  })

  it('rejects forged RSVP counts independently of the browser selector', () => {
    expect(guestRules).toContain('CHECK (plus_ones <= allowed_plus_ones)')
    expect(guestRules).toContain('selected_plus_ones NOT BETWEEN 0 AND coalesce(current_guest.allowed_plus_ones, 0)')
    expect(guestRules).toContain('cardinality(selected_names) > selected_plus_ones')
  })
})
