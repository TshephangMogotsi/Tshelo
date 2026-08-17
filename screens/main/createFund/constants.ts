import Ionicons from '@expo/vector-icons/Ionicons'
import countries from 'world-countries'
import { TOKEN_FEATURE_PRICES } from '../../../lib/tokenPricing'

export const BRAND_PURPLE = '#7657F0'
export const BRAND_PURPLE_DARK = '#7439E0'
export const BRAND_PURPLE_MID = '#8874E1'
export const BRAND_LAVENDER = '#EAE4FB'
export const BRAND_ACCENT = '#F59E0B'
export const BACK_HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 }

export type CreateOption = 'event' | 'fund' | 'eventFund'
export type QuickActionId = 'joinFund' | 'joinEvent' | 'contribution' | 'expense' | 'members' | 'tokens'
export type FundCurrency = string
export type PickedOrganiser = {
  id: string
  userId?: string
  name: string
  phone?: string
  initials: string
}
export type EventTypeOption = { id: string; label: string; emoji: string }
export type EmojiOption = { id: string; label: string; emoji: string }
export type CreatedEvent = {
  id: string
  share_code: string | null
}

export const EVENT_TYPES: EventTypeOption[] = [
  { id: 'wedding',    label: 'Wedding',    emoji: '🏠' },
  { id: 'funeral',    label: 'Funeral',    emoji: '🕯️' },
  { id: 'graduation', label: 'Graduation', emoji: '🎓' },
  { id: 'birthday',   label: 'Birthday',   emoji: '🎂' },
  { id: 'baby',       label: 'Baby shower', emoji: '👶' },
  { id: 'other',      label: 'Other',      emoji: '🎉' },
]

export const EMOJI_OPTIONS: EmojiOption[] = [
  { id: 'heart',      label: 'Support',    emoji: '💜' },
  { id: 'funeral',    label: 'Funeral',    emoji: '🕯️' },
  { id: 'celebration', label: 'Event',      emoji: '🏠' },
  { id: 'graduation', label: 'Graduation', emoji: '🎓' },
]

export const CUSTOM_EVENT_EMOJIS = ['🎉', '✨', '💜', '🙏']

export const GOAL_PRESETS = [
  { label: 'P5k',  value: '5,000' },
  { label: 'P10k', value: '10,000' },
  { label: 'P15k', value: '15,000' },
  { label: 'P25k', value: '25,000' },
]

export const EVENT_BUDGET_PRESETS = [
  { label: 'P10k',  value: '10,000' },
  { label: 'P25k',  value: '25,000' },
  { label: 'P50k',  value: '50,000' },
  { label: 'P100k', value: '100,000' },
]

export const QUICK_ACTIONS: {
  id: QuickActionId
  title: string
  subtitle: string
  icon: keyof typeof Ionicons.glyphMap
  needsFund: boolean
}[] = [
  { id: 'joinFund',     title: 'Join',    subtitle: 'a Fund',       icon: 'link-outline',       needsFund: false },
  { id: 'joinEvent',    title: 'Join',    subtitle: 'an Event',     icon: 'ticket-outline',     needsFund: false },
  { id: 'contribution', title: 'Record',  subtitle: 'Contribution', icon: 'add-circle-outline', needsFund: true },
  { id: 'expense',      title: 'Record',  subtitle: 'Expense',      icon: 'receipt-outline',    needsFund: true },
  { id: 'members',      title: 'Add',     subtitle: 'Members',      icon: 'person-add-outline', needsFund: true },
  // 'tokens' is intentionally not in this list — it gets its own section
  // on the create hub instead of a rail chip (see CreateOptionChooser)
]

export const CREATE_OPTIONS: {
  id: CreateOption
  title: string
  description: string
  price: string
  icon: keyof typeof Ionicons.glyphMap
  tint: string
  iconBg: string
  featured?: boolean
}[] = [
  {
    id: 'fund',
    title: 'Create a Fund',
    description: 'Track contributions',
    price: 'FREE',
    icon: 'wallet-outline',
    tint: BRAND_PURPLE_MID,
    iconBg: BRAND_LAVENDER,
  },
  {
    id: 'eventFund',
    title: 'Event + Fund',
    description: 'Plan event & collect contributions',
    price: `${TOKEN_FEATURE_PRICES.eventFund}`,
    icon: 'albums-outline',
    tint: BRAND_PURPLE_DARK,
    iconBg: BRAND_LAVENDER,
    featured: true,
  },
  {
    id: 'event',
    title: 'Event Only',
    description: 'Manage invitations and RSVPs',
    price: 'FREE',
    icon: 'calendar-outline',
    tint: BRAND_PURPLE,
    iconBg: BRAND_LAVENDER,
  },
]

type FundCurrencyOption = {
  id: FundCurrency
  code: string
  name: string
  helper?: string
  symbol: string
}

const currencyByCode = new Map<string, FundCurrencyOption>()
for (const country of countries) {
  for (const [code, details] of Object.entries(country.currencies)) {
    if (!currencyByCode.has(code)) {
      currencyByCode.set(code, { id: code, code, name: details.name, symbol: details.symbol || code })
    }
  }
}

const primaryCurrencyOverrides: Record<string, Partial<FundCurrencyOption>> = {
  BWP: { name: 'Pula', symbol: 'P', helper: 'Your home currency' },
  ZAR: { name: 'Rand', symbol: 'R' },
  USD: { name: 'US dollar', symbol: '$' },
}

for (const [code, overrides] of Object.entries(primaryCurrencyOverrides)) {
  const currency = currencyByCode.get(code)
  if (currency) currencyByCode.set(code, { ...currency, ...overrides })
}

export const FUND_CURRENCIES: FundCurrencyOption[] = [...currencyByCode.values()].sort((a, b) => {
  const primaryOrder = ['BWP', 'ZAR', 'USD']
  const aIndex = primaryOrder.indexOf(a.code)
  const bIndex = primaryOrder.indexOf(b.code)
  if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? primaryOrder.length : aIndex) - (bIndex === -1 ? primaryOrder.length : bIndex)
  return a.name.localeCompare(b.name)
})
