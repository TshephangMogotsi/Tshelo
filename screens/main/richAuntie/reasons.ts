export const RICH_AUNTIE_REASONS = [
  { code: 'bought_outfit', label: 'Bought the outfit' },
  { code: 'paid_catering', label: 'Paid for catering' },
  { code: 'covered_tent', label: 'Covered the tent' },
  { code: 'bought_cake', label: 'Bought the cake' },
  { code: 'major_contribution', label: 'Major contribution' },
  { code: 'transport_costs', label: 'Transport costs' },
] as const

export type RichAuntieReasonCode = typeof RICH_AUNTIE_REASONS[number]['code'] | 'custom'

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}
