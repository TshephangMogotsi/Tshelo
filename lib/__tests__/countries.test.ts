import {
  FEATURED_SIGNUP_COUNTRIES,
  SIGNUP_COUNTRIES,
  findSignupCountry,
  searchSignupCountries,
} from '../countries'

describe('signup countries', () => {
  it('keeps the six featured countries and their existing launch currencies', () => {
    expect(FEATURED_SIGNUP_COUNTRIES.map(country => country.code)).toEqual([
      'BW', 'ZA', 'ZW', 'ZM', 'KE', 'GH',
    ])
    expect(findSignupCountry('BW')).toMatchObject({ currency: 'BWP', dialCode: '+267' })
    expect(findSignupCountry('ZW')).toMatchObject({ currency: 'USD', dialCode: '+263' })
  })

  it('provides a full international list with safe shared calling codes', () => {
    expect(SIGNUP_COUNTRIES.length).toBeGreaterThan(200)
    expect(findSignupCountry('US')).toMatchObject({ name: 'United States', currency: 'USD', dialCode: '+1' })
    expect(findSignupCountry('GB')).toMatchObject({ name: 'United Kingdom', currency: 'GBP', dialCode: '+44' })
  })

  it('searches by country name, country code, currency, and calling code', () => {
    expect(searchSignupCountries('namibia').map(country => country.code)).toContain('NA')
    expect(searchSignupCountries('NAD').map(country => country.code)).toContain('NA')
    expect(searchSignupCountries('+264').map(country => country.code)).toContain('NA')
  })
})
