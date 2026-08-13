export type RsvpGuest = {
  status: 'confirmed' | 'pending' | 'declined'
  plusOnes: number
}

export function summarizeEventGuests(guests: RsvpGuest[]) {
  return guests.reduce((summary, guest) => {
    const partySize = 1 + Math.max(0, Number(guest.plusOnes) || 0)
    summary.invitedPeople += partySize

    if (guest.status === 'confirmed') {
      summary.confirmedPeople += partySize
      summary.confirmedInvitations += 1
    } else if (guest.status === 'declined') {
      summary.declinedInvitations += 1
    } else {
      summary.pendingInvitations += 1
    }

    return summary
  }, {
    invitedPeople: 0,
    confirmedPeople: 0,
    confirmedInvitations: 0,
    pendingInvitations: 0,
    declinedInvitations: 0,
  })
}

export function parseEstimatedSpend(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const amount = Number(trimmed.replace(/,/g, ''))
  return Number.isFinite(amount) && amount >= 0 ? amount : Number.NaN
}
