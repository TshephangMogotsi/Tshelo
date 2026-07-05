import { formatMoney, formatEventDate, labelFromValue, initials } from '../helpers'

describe('formatMoney', () => {
  it('uses the P symbol for BWP', () => {
    expect(formatMoney(1500, 'BWP')).toBe('P 1,500')
  })

  it('falls back to the currency code for other currencies', () => {
    expect(formatMoney(2000, 'ZAR')).toBe('ZAR 2,000')
  })
})

describe('formatEventDate', () => {
  it('formats an ISO date for display', () => {
    expect(formatEventDate('2026-08-15')).toBe('15 Aug 2026')
  })

  it('returns Date TBC for empty values', () => {
    expect(formatEventDate('')).toBe('Date TBC')
  })

  it('passes through malformed values unchanged', () => {
    expect(formatEventDate('soon')).toBe('soon')
  })
})

describe('labelFromValue', () => {
  it('title-cases snake_case and kebab-case values', () => {
    expect(labelFromValue('orange_money')).toBe('Orange Money')
    expect(labelFromValue('event-fund')).toBe('Event Fund')
  })

  it('defaults to Fund for missing values', () => {
    expect(labelFromValue(null)).toBe('Fund')
    expect(labelFromValue(undefined)).toBe('Fund')
  })
})

describe('initials', () => {
  it('builds two-letter initials from a name', () => {
    expect(initials('Kgosi Moeng')).toBe('KM')
    expect(initials('Naledi')).toBe('N')
  })
})
