export type RsvpChoice = 'yes' | 'maybe' | 'no'

export function allowedPlusOnes(value: unknown) {
  const numeric = Math.floor(Number(value) || 0)
  return Math.max(0, Math.min(20, numeric))
}

export function invitationAllowanceTitle(value: unknown) {
  const allowance = allowedPlusOnes(value)
  if (allowance === 0) return 'This invitation is for you only.'
  if (allowance === 1) return 'This invitation is for you and 1 additional guest.'
  return `This invitation is for you and up to ${allowance} additional guests.`
}

export function resizePlusOneNames(current: string[], count: number) {
  return Array.from({ length: allowedPlusOnes(count) }, (_, index) => current[index] ?? '')
}

export function rsvpParty(status: RsvpChoice, plusOnes: number, names: string[]) {
  const selected = status === 'no' ? 0 : allowedPlusOnes(plusOnes)
  return {
    plus_ones: selected,
    plus_ones_names: status === 'no'
      ? []
      : names.slice(0, selected).map(name => name.trim()).filter(Boolean),
  }
}
