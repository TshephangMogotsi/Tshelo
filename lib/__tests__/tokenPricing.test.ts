import { ANNUAL_PASSES, CHECKOUT_OFFERS, TOKEN_FEATURE_PRICES, TOKEN_PACKS, tokenPriceLabel } from '../tokenPricing'

describe('token pricing', () => {
  it('uses the revised single Botswana top-up', () => {
    expect(TOKEN_PACKS.map(({ id, tokens, priceBWP }) => ({ id, tokens, priceBWP }))).toEqual([
      { id: 'top_up_60', tokens: 60, priceBWP: 50 },
    ])
  })

  it('keeps the two dated annual passes distinct from token top-ups', () => {
    expect(ANNUAL_PASSES.map(({ id, priceBWP, termLabel }) => ({ id, priceBWP, termLabel }))).toEqual([
      { id: 'unlimited_12m', priceBWP: 300, termLabel: '12-month dated pass · no automatic renewal' },
      { id: 'committee_12m', priceBWP: 750, termLabel: '12-month dated pass · no automatic renewal' },
    ])
    expect(CHECKOUT_OFFERS.map(({ id }) => id)).toEqual([
      'top_up_60',
      'unlimited_12m',
      'committee_12m',
    ])
  })

  it('keeps the currently surfaced feature costs in one source of truth', () => {
    expect(TOKEN_FEATURE_PRICES.additionalFund).toBe(10)
    expect(TOKEN_FEATURE_PRICES.additionalEvent).toBe(10)
    expect(TOKEN_FEATURE_PRICES.eventFund).toBe(15)
    expect(TOKEN_FEATURE_PRICES.interimPdf).toBe(3)
    expect(TOKEN_FEATURE_PRICES.certifiedAudit).toBe(10)
  })

  it('formats rounded thebe-per-token labels', () => {
    expect(tokenPriceLabel(50, 60)).toBe('83t/token')
  })
})
