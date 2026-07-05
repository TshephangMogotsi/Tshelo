import {
  sanitizeAmountInput,
  parseAmount,
  formatWholeAmount,
  formatDateISO,
  formatTimeISO,
  getInitials,
} from '../format'

describe('sanitizeAmountInput', () => {
  it('keeps digits, commas and dots', () => {
    expect(sanitizeAmountInput('1,500.50')).toBe('1,500.50')
  })

  it('strips letters, currency symbols and spaces', () => {
    expect(sanitizeAmountInput('P1 500')).toBe('1500')
    expect(sanitizeAmountInput('abc')).toBe('')
  })
})

describe('parseAmount', () => {
  it('parses plain and comma-grouped amounts', () => {
    expect(parseAmount('1500')).toBe(1500)
    expect(parseAmount('1,500.50')).toBe(1500.5)
    expect(parseAmount('50,000')).toBe(50000)
  })

  it('returns 0 for unparseable input', () => {
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })
})

describe('formatWholeAmount', () => {
  it('prefixes P and groups thousands', () => {
    expect(formatWholeAmount(1500000)).toBe('P1,500,000')
    expect(formatWholeAmount(0)).toBe('P0')
  })

  it('rounds fractional thebe away', () => {
    expect(formatWholeAmount(1500.75)).toBe('P1,501')
  })
})

describe('formatDateISO / formatTimeISO', () => {
  it('formats zero-padded ISO parts', () => {
    const d = new Date(2026, 6, 5, 9, 8, 7) // 5 July 2026 09:08:07
    expect(formatDateISO(d)).toBe('2026-07-05')
    expect(formatTimeISO(d)).toBe('09:08:07')
  })
})

describe('getInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getInitials('Kgosi Moeng')).toBe('KM')
    expect(getInitials('Naledi')).toBe('N')
    expect(getInitials('Mpho  Tebogo Sefuthi')).toBe('MT')
  })

  it('falls back to ? for empty input', () => {
    expect(getInitials('')).toBe('?')
    expect(getInitials('   ')).toBe('?')
  })
})
