import { Ionicons } from '@expo/vector-icons'

export const BRAND_PURPLE = '#7657F0'
export const BRAND_PURPLE_DARK = '#7439E0'
export const BRAND_PURPLE_MID = '#8874E1'
export const BRAND_LAVENDER = '#EAE4FB'
export const BRAND_ACCENT = '#F59E0B'
export const BACK_HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 }

export type CreateOption = 'event' | 'fund' | 'eventFund'
export type FundCurrency = 'BWP' | 'ZAR' | 'USD' | 'KES'
export type PickedOrganiser = {
  id: string
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
    id: 'event',
    title: 'Event only',
    description: 'Guest list & budget tracking',
    price: 'FREE',
    icon: 'calendar-outline',
    tint: BRAND_PURPLE,
    iconBg: BRAND_LAVENDER,
  },
  {
    id: 'fund',
    title: 'Fund only',
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
    price: '15',
    icon: 'albums-outline',
    tint: BRAND_PURPLE_DARK,
    iconBg: BRAND_PURPLE,
    featured: true,
  },
]

export const FUND_CURRENCIES: {
  id: FundCurrency
  code: string
  name: string
  helper?: string
  symbol: string
}[] = [
  { id: 'BWP', code: 'BWP', name: 'Pula',     helper: 'Your home currency', symbol: 'P' },
  { id: 'ZAR', code: 'ZAR', name: 'Rand',     symbol: 'R' },
  { id: 'USD', code: 'USD', name: 'Dollar',   symbol: '$' },
  { id: 'KES', code: 'KES', name: 'Shilling', symbol: 'KSh' },
]
