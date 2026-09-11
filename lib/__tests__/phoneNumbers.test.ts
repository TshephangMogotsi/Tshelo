import {
  internationalPhone,
  isValidNationalPhone,
  maskedInternationalPhone,
  phoneInputConfig,
} from '../phoneNumbers'

describe('international phone helpers', () => {
  it('preserves exact validation for the featured countries', () => {
    const botswana = phoneInputConfig('BW', '+267')
    expect(isValidNationalPhone('71 234 567', botswana)).toBe(true)
    expect(isValidNationalPhone('71 234 56', botswana)).toBe(false)
    expect(isValidNationalPhone('71 234 5678', botswana)).toBe(false)
  })

  it('uses the E.164 length limit for other countries', () => {
    const unitedStates = phoneInputConfig('US', '+1')
    expect(unitedStates).toMatchObject({ minDigits: 6, maxDigits: 14 })
    expect(isValidNationalPhone('202 555 0123', unitedStates)).toBe(true)
    expect(internationalPhone('+1', '202 555 0123')).toBe('+12025550123')
  })

  it('masks international numbers without assuming a Botswana prefix', () => {
    expect(maskedInternationalPhone('+12025550123')).toBe('+1202*****23')
    expect(maskedInternationalPhone('+26771234567')).toBe('+2677*****67')
  })
})
