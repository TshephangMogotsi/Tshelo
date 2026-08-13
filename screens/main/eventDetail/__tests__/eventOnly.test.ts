import { parseEstimatedSpend, summarizeEventGuests } from '../eventOnly'

describe('summarizeEventGuests', () => {
  it('counts confirmed attendees including plus ones', () => {
    expect(summarizeEventGuests([
      { status: 'confirmed', plusOnes: 2 },
      { status: 'confirmed', plusOnes: 0 },
      { status: 'pending', plusOnes: 1 },
      { status: 'declined', plusOnes: 0 },
    ])).toEqual({
      invitedPeople: 7,
      confirmedPeople: 4,
      confirmedInvitations: 2,
      pendingInvitations: 1,
      declinedInvitations: 1,
    })
  })
})

describe('parseEstimatedSpend', () => {
  it('treats an empty value as an omitted estimate', () => {
    expect(parseEstimatedSpend('')).toBeNull()
  })

  it('parses formatted non-negative amounts', () => {
    expect(parseEstimatedSpend('25,000')).toBe(25_000)
    expect(parseEstimatedSpend('0')).toBe(0)
  })

  it('rejects malformed or negative amounts', () => {
    expect(parseEstimatedSpend('abc')).toBeNaN()
    expect(parseEstimatedSpend('-1')).toBeNaN()
  })
})
