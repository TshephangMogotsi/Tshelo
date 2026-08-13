export type TokenPackId = 'starter' | 'value' | 'popular' | 'power'

export type TokenPack = {
  id: TokenPackId
  tokens: number
  priceBWP: number
  label: string
  popular: boolean
  description: string
}

export const TOKEN_PACKS: readonly TokenPack[] = [
  {
    id: 'starter',
    tokens: 10,
    priceBWP: 5,
    label: 'Starter',
    popular: false,
    description: 'Good for trying out the app.',
  },
  {
    id: 'value',
    tokens: 30,
    priceBWP: 13,
    label: 'Value',
    popular: false,
    description: 'Save 13% vs Starter.',
  },
  {
    id: 'popular',
    tokens: 60,
    priceBWP: 24,
    label: 'Popular',
    popular: true,
    description: 'Save 20% vs Starter.',
  },
  {
    id: 'power',
    tokens: 120,
    priceBWP: 45,
    label: 'Power',
    popular: false,
    description: 'Save 25% vs Starter.',
  },
] as const

export const TOKEN_FEATURE_PRICES = {
  additionalFund: 10,
  additionalEvent: 10,
  eventFund: 15,
  members21To50: 15,
  members51To100: 30,
  members101To250: 60,
  eventGuestListOver100: 10,
  interimPdf: 3,
  certifiedAudit: 10,
  yearEndStatement: 5,
  smartPlan: 8,
  vendorDirectoryByRegion: 5,
} as const

export function tokenPriceLabel(priceBWP: number, tokens: number): string {
  return `${Math.round((priceBWP / tokens) * 100)}t/token`
}
