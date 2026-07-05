import { detectProvider, detectProviderOrUnknown, PROVIDER_LABELS } from '../providers'

describe('detectProvider', () => {
  // Botswana prefix rules: 71/72/73/76 Orange, 74/75 MyZaka (Mascom), 77 Smega (BTC)
  it.each(['71', '72', '73', '76'])('maps %s numbers to orange_money', prefix => {
    expect(detectProvider(`${prefix}234567`)).toBe('orange_money')
  })

  it.each(['74', '75'])('maps %s numbers to myzaka', prefix => {
    expect(detectProvider(`${prefix}234567`)).toBe('myzaka')
  })

  it('maps 77 numbers to smega', () => {
    expect(detectProvider('77234567')).toBe('smega')
  })

  it('returns null for unassigned prefixes', () => {
    expect(detectProvider('70234567')).toBeNull()
    expect(detectProvider('78234567')).toBeNull()
  })

  it('strips the 267 country code', () => {
    expect(detectProvider('+26771234567')).toBe('orange_money')
    expect(detectProvider('26774234567')).toBe('myzaka')
  })

  it('ignores spaces and punctuation', () => {
    expect(detectProvider('71 234 567')).toBe('orange_money')
    expect(detectProvider('+267-77-234-567')).toBe('smega')
  })

  it('returns null when there are not enough digits', () => {
    expect(detectProvider('')).toBeNull()
    expect(detectProvider('7')).toBeNull()
    expect(detectProvider('+267')).toBeNull()
  })
})

describe('detectProviderOrUnknown', () => {
  it('falls back to unknown instead of null', () => {
    expect(detectProviderOrUnknown('78234567')).toBe('unknown')
    expect(detectProviderOrUnknown('71234567')).toBe('orange_money')
  })
})

describe('PROVIDER_LABELS', () => {
  it('has a label for every provider and the unknown fallback', () => {
    expect(PROVIDER_LABELS.orange_money).toBe('Orange Money')
    expect(PROVIDER_LABELS.myzaka).toBe('MyZaka')
    expect(PROVIDER_LABELS.smega).toBe('Smega')
    expect(PROVIDER_LABELS.unknown).toBe('Mobile Money')
  })
})
