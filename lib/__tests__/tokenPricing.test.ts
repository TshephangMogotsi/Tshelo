import { TOKEN_FEATURE_PRICES, TOKEN_PACKS, tokenPriceLabel } from '../tokenPricing'

describe('token pricing', () => {
  it('uses the client-approved Botswana pack ladder', () => {
    expect(TOKEN_PACKS.map(({ id, tokens, priceBWP }) => ({ id, tokens, priceBWP }))).toEqual([
      { id: 'starter', tokens: 10, priceBWP: 5 },
      { id: 'value', tokens: 30, priceBWP: 13 },
      { id: 'popular', tokens: 60, priceBWP: 24 },
      { id: 'power', tokens: 120, priceBWP: 45 },
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
    expect(tokenPriceLabel(5, 10)).toBe('50t/token')
    expect(tokenPriceLabel(13, 30)).toBe('43t/token')
    expect(tokenPriceLabel(24, 60)).toBe('40t/token')
    expect(tokenPriceLabel(45, 120)).toBe('38t/token')
  })
})
