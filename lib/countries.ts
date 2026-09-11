import countries from 'world-countries'

export type SignupCountry = {
  code: string
  name: string
  currency: string
  currencyName: string
  flag: string
  dialCode: string
}

const FEATURED_COUNTRY_CODES = ['BW', 'ZA', 'ZW', 'ZM', 'KE', 'GH'] as const

const COUNTRY_OVERRIDES: Record<string, Partial<SignupCountry>> = {
  BW: { currency: 'BWP', currencyName: 'Pula', dialCode: '+267' },
  ZA: { currency: 'ZAR', currencyName: 'Rand', dialCode: '+27' },
  ZW: { currency: 'USD', currencyName: 'Dollar', dialCode: '+263' },
  ZM: { currency: 'ZMW', currencyName: 'Kwacha', dialCode: '+260' },
  KE: { currency: 'KES', currencyName: 'Shilling', dialCode: '+254' },
  GH: { currency: 'GHS', currencyName: 'Cedi', dialCode: '+233' },
}

function countryDialCode(root: string, suffixes: string[]) {
  if (!root) return ''
  return suffixes.length === 1 ? `${root}${suffixes[0]}` : root
}

export const SIGNUP_COUNTRIES: readonly SignupCountry[] = countries.flatMap(country => {
  const currency = Object.entries(country.currencies)[0]
  const dialCode = countryDialCode(country.idd.root, country.idd.suffixes)
  if (!country.cca2 || !country.name.common || !currency || !dialCode) return []

  const [currencyCode, currencyDetails] = currency
  const base: SignupCountry = {
    code: country.cca2,
    name: country.name.common,
    currency: currencyCode,
    currencyName: currencyDetails.name,
    flag: country.flag,
    dialCode,
  }
  return [{ ...base, ...COUNTRY_OVERRIDES[country.cca2] }]
}).sort((a, b) => a.name.localeCompare(b.name))

export const FEATURED_SIGNUP_COUNTRIES: readonly SignupCountry[] = FEATURED_COUNTRY_CODES.flatMap(code => {
  const country = SIGNUP_COUNTRIES.find(item => item.code === code)
  return country ? [country] : []
})

export function findSignupCountry(code: string) {
  return SIGNUP_COUNTRIES.find(country => country.code === code)
}

export function searchSignupCountries(search: string) {
  const query = search.trim().toLowerCase()
  if (!query) return SIGNUP_COUNTRIES
  return SIGNUP_COUNTRIES.filter(country => [
    country.name,
    country.code,
    country.currency,
    country.currencyName,
    country.dialCode,
  ].some(value => value.toLowerCase().includes(query)))
}
