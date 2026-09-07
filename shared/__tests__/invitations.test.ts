import {
  INVITATION_WEB_ORIGIN,
  invitationAccountPath,
  invitationUrl,
  normalizeInvitationCode,
  parseInvitationUrl,
} from '../invitations'

describe('invitation links', () => {
  it('builds canonical HTTPS event and fund links', () => {
    expect(invitationUrl('event', 'evt-a1b2c3d4')).toBe(`${INVITATION_WEB_ORIGIN}/invite/event/EVT-A1B2C3D4`)
    expect(invitationUrl('fund', 'fnd-a1b2c3d4')).toBe(`${INVITATION_WEB_ORIGIN}/invite/fund/FND-A1B2C3D4`)
  })

  it('maps invitations to the authenticated web join flows', () => {
    expect(invitationAccountPath({ kind: 'event', code: 'EVT-A1B2C3D4' })).toBe('/account/events?joinCode=EVT-A1B2C3D4')
    expect(invitationAccountPath({ kind: 'fund', code: 'FND-A1B2C3D4' })).toBe('/account/funds?joinCode=FND-A1B2C3D4')
  })

  it('parses canonical universal links and legacy custom-scheme links', () => {
    expect(parseInvitationUrl('https://app.tshelo.com/invite/event/evt-a1b2c3d4')).toEqual({ kind: 'event', code: 'EVT-A1B2C3D4' })
    expect(parseInvitationUrl('tshelo://join/fnd-a1b2c3d4')).toEqual({ kind: 'fund', code: 'FND-A1B2C3D4' })
    expect(parseInvitationUrl('exp+tshelo://event/evt-a1b2c3d4')).toEqual({ kind: 'event', code: 'EVT-A1B2C3D4' })
  })

  it('rejects foreign hosts, invalid kinds, and malformed codes', () => {
    expect(parseInvitationUrl('https://example.com/invite/event/EVT-A1B2C3D4')).toBeNull()
    expect(parseInvitationUrl('https://app.tshelo.com/invite/admin/EVT-A1B2C3D4')).toBeNull()
    expect(parseInvitationUrl('https://app.tshelo.com/invite/event/short')).toBeNull()
    expect(parseInvitationUrl('https://app.tshelo.com/invite/event/EVT-A1B2C3D4/extra')).toBeNull()
    expect(normalizeInvitationCode('EVT-ABC/123')).toBeNull()
  })
})
