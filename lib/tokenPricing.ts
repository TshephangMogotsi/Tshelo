export type TokenPackId = 'top_up_60'
export type AnnualPassId = 'unlimited_12m' | 'committee_12m'
export type CheckoutOfferId = TokenPackId | AnnualPassId

export type TokenPack = {
  id: TokenPackId
  kind: 'token_top_up'
  tokens: number
  priceBWP: number
  label: string
  description: string
}

export type AnnualPass = {
  id: AnnualPassId
  kind: 'annual_pass'
  priceBWP: number
  label: string
  description: string
  termLabel: string
  includes: readonly string[]
}

export type CheckoutOffer = TokenPack | AnnualPass

export const TOKEN_PACKS: readonly TokenPack[] = [
  {
    id: 'top_up_60',
    kind: 'token_top_up',
    tokens: 60,
    priceBWP: 50,
    label: 'Token top-up',
    description: '60 tokens for extra features whenever you need them.',
  },
] as const

export const ANNUAL_PASSES: readonly AnnualPass[] = [
  {
    id: 'unlimited_12m',
    kind: 'annual_pass',
    priceBWP: 300,
    label: 'Unlimited',
    description: 'For organisers who run funds and events regularly.',
    termLabel: '12-month dated pass · no automatic renewal',
    includes: [
      'Unlimited funds and events, up to 25 active at once',
      'Up to 100 members on every fund',
      'Every report and Smart Plan',
      'Priority support and Verified badge eligibility',
    ],
  },
  {
    id: 'committee_12m',
    kind: 'annual_pass',
    priceBWP: 750,
    label: 'Committee',
    description: 'For burial societies, stokvels, and family committees.',
    termLabel: '12-month dated pass · no automatic renewal',
    includes: [
      'Everything in Unlimited',
      'Up to five shared administrators with separate audit trails',
      'Unlimited members on every fund',
      'Monthly committee statements and an annual general-meeting pack',
    ],
  },
] as const

export const CHECKOUT_OFFERS: readonly CheckoutOffer[] = [
  ...TOKEN_PACKS,
  ...ANNUAL_PASSES,
] as const

export function isTokenPack(offer: CheckoutOffer): offer is TokenPack {
  return offer.kind === 'token_top_up'
}

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
