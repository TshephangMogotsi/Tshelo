import { richAuntieHeroTitle, summarizeRichAuntieStatus } from '../status'

describe('summarizeRichAuntieStatus', () => {
  it('counts only confirmed, non-refunded cash', () => {
    const summary = summarizeRichAuntieStatus([
      { fund_id: 'fund-1', amount: 500, status: 'confirmed', is_refunded: false },
      { fund_id: 'fund-1', amount: '250', status: 'confirmed', is_refunded: null },
      { fund_id: 'fund-2', amount: 900, status: 'pledged', is_refunded: false },
      { fund_id: 'fund-3', amount: 300, status: 'confirmed', is_refunded: true },
    ], [])

    expect(summary.cashGiven).toBe(750)
    expect(summary.fundCount).toBe(1)
  })

  it('does not grant Rich Auntie status without an award', () => {
    const summary = summarizeRichAuntieStatus([
      { fund_id: 'fund-1', amount: 100, status: 'confirmed', is_refunded: false },
    ], [])

    expect(summary.isRichAuntie).toBe(false)
    expect(richAuntieHeroTitle(false, 0)).toBe('Rich Auntie status')
  })

  it('includes direct-purchase award funds in funds helped', () => {
    const summary = summarizeRichAuntieStatus([
      { fund_id: 'fund-1', amount: 100, status: 'confirmed', is_refunded: false },
    ], [
      { fund_id: 'fund-2' },
      { fund_id: 'fund-2' },
    ])

    expect(summary.fundCount).toBe(2)
    expect(summary.isRichAuntie).toBe(true)
    expect(richAuntieHeroTitle(false, 2)).toBe('You’re a Rich Auntie!')
  })

  it('bases consistent contributor status on contributed funds, not awards', () => {
    const awardedOnly = summarizeRichAuntieStatus([], [
      { fund_id: 'fund-1' },
      { fund_id: 'fund-2' },
      { fund_id: 'fund-3' },
    ])
    const contributed = summarizeRichAuntieStatus([
      { fund_id: 'fund-1', amount: 100, status: 'confirmed', is_refunded: false },
      { fund_id: 'fund-2', amount: 100, status: 'confirmed', is_refunded: false },
      { fund_id: 'fund-3', amount: 100, status: 'confirmed', is_refunded: false },
    ], [])

    expect(awardedOnly.isConsistentContributor).toBe(false)
    expect(contributed.isConsistentContributor).toBe(true)
  })
})
