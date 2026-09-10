import { allowedPlusOnes, invitationAllowanceTitle, resizePlusOneNames, rsvpParty } from '../rsvp'

describe('native event RSVP helpers', () => {
  it('bounds personal guest allowances from rolling API values', () => {
    expect(allowedPlusOnes(undefined)).toBe(0)
    expect(allowedPlusOnes(-2)).toBe(0)
    expect(allowedPlusOnes(50)).toBe(20)
  })

  it('describes personal invitations clearly', () => {
    expect(invitationAllowanceTitle(0)).toBe('This invitation is for you only.')
    expect(invitationAllowanceTitle(1)).toContain('1 additional guest')
    expect(invitationAllowanceTitle(3)).toContain('up to 3 additional guests')
  })

  it('retains names when the selected count changes and strips unused entries', () => {
    expect(resizePlusOneNames(['Neo'], 2)).toEqual(['Neo', ''])
    expect(rsvpParty('yes', 2, [' Neo ', ''])).toEqual({ plus_ones: 2, plus_ones_names: ['Neo'] })
    expect(rsvpParty('no', 2, ['Neo', 'Kago'])).toEqual({ plus_ones: 0, plus_ones_names: [] })
  })
})
