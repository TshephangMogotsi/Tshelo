type PhoneInputConfig = {
  placeholder: string
  minDigits: number
  maxDigits: number
}

const COUNTRY_PHONE_CONFIG: Record<string, PhoneInputConfig> = {
  BW: { placeholder: '71 234 567', minDigits: 8, maxDigits: 8 },
  ZA: { placeholder: '82 123 4567', minDigits: 9, maxDigits: 9 },
  ZW: { placeholder: '77 123 4567', minDigits: 9, maxDigits: 9 },
  ZM: { placeholder: '97 123 4567', minDigits: 9, maxDigits: 9 },
  KE: { placeholder: '71 234 5678', minDigits: 9, maxDigits: 9 },
  GH: { placeholder: '24 123 4567', minDigits: 9, maxDigits: 9 },
}

export function nationalPhoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function phoneInputConfig(countryCode: string, dialCode: string): PhoneInputConfig {
  const known = COUNTRY_PHONE_CONFIG[countryCode]
  if (known) return known

  const dialDigits = nationalPhoneDigits(dialCode).length
  return {
    placeholder: 'National phone number',
    minDigits: 6,
    maxDigits: Math.max(6, 15 - dialDigits),
  }
}

export function isValidNationalPhone(value: string, config: PhoneInputConfig) {
  const length = nationalPhoneDigits(value).length
  return length >= config.minDigits && length <= config.maxDigits
}

export function internationalPhone(dialCode: string, nationalNumber: string) {
  return `+${nationalPhoneDigits(dialCode)}${nationalPhoneDigits(nationalNumber)}`
}

export function maskedInternationalPhone(phone: string) {
  const digits = nationalPhoneDigits(phone)
  if (digits.length <= 4) return phone
  const visibleStart = Math.min(4, digits.length - 2)
  return `+${digits.slice(0, visibleStart)}${'*'.repeat(Math.max(2, digits.length - visibleStart - 2))}${digits.slice(-2)}`
}
