export type MobileMoneyProvider = 'orange_money' | 'myzaka' | 'smega'

export const PROVIDER_LABELS: Record<MobileMoneyProvider | 'unknown', string> = {
  orange_money: 'Orange Money',
  myzaka:       'MyZaka',
  smega:        'Smega',
  unknown:      'Mobile Money',
}

// Botswana mobile prefixes: 71/72/73/76 → Orange, 74/75 → Mascom (MyZaka),
// 77 → BTC (Smega). Accepts local (71234567) and international (+267…) forms.
export function detectProvider(phone: string): MobileMoneyProvider | null {
  const digits = phone.replace(/\D/g, '').replace(/^267/, '')
  if (digits.length < 2) return null
  const prefix = parseInt(digits.slice(0, 2), 10)
  if ([71, 72, 73, 76].includes(prefix)) return 'orange_money'
  if ([74, 75].includes(prefix))         return 'myzaka'
  if (prefix === 77)                     return 'smega'
  return null
}

export function detectProviderOrUnknown(phone: string): MobileMoneyProvider | 'unknown' {
  return detectProvider(phone) ?? 'unknown'
}
