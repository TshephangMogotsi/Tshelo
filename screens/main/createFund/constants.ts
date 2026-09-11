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
export type EventTypeOption = {
  id: string
  label: string
  emoji: string
  icon: keyof typeof Ionicons.glyphMap
}
export type EmojiOption = {
  id: string
  label: string
  emoji: string
  icon?: keyof typeof Ionicons.glyphMap
}
export type CreatedEvent = {
  id: string
  share_code: string | null
}

export const EVENT_TYPES: EventTypeOption[] = [
  { id: 'wedding',    label: 'Wedding',    emoji: '🏠', icon: 'heart-outline' },
  { id: 'funeral',    label: 'Funeral',    emoji: '🕯️', icon: 'flame-outline' },
  { id: 'graduation', label: 'Graduation', emoji: '🎓', icon: 'school-outline' },
  { id: 'birthday',   label: 'Birthday',   emoji: '🎂', icon: 'gift-outline' },
  { id: 'baby',       label: 'Baby shower', emoji: '👶', icon: 'happy-outline' },
  { id: 'other',      label: 'Other',      emoji: '🎉', icon: 'shapes-outline' },
]

export const EMOJI_OPTIONS: EmojiOption[] = [
  { id: 'general',   label: 'General',   emoji: '💜', icon: 'wallet-outline' },
  { id: 'memorial',  label: 'Memorial',  emoji: '🕯️', icon: 'flame-outline' },
  { id: 'family',    label: 'Family',    emoji: '🏠', icon: 'home-outline' },
  { id: 'education', label: 'Education', emoji: '🎓', icon: 'school-outline' },
  { id: 'other',     label: 'Other',     emoji: '✨', icon: 'shapes-outline' },
]

export const OTHER_FUND_ICON_OPTIONS: EmojiOption[] = [
  { id: 'health',      label: 'Health',      emoji: '🩺', icon: 'medical-outline' },
  { id: 'community',   label: 'Community',   emoji: '🤝', icon: 'people-outline' },
  { id: 'business',    label: 'Business',    emoji: '💼', icon: 'briefcase-outline' },
  { id: 'travel',      label: 'Travel',      emoji: '✈️', icon: 'airplane-outline' },
  { id: 'celebration', label: 'Celebration', emoji: '🎁', icon: 'gift-outline' },
  { id: 'sport',       label: 'Sport',       emoji: '⚽', icon: 'football-outline' },
  { id: 'pets',        label: 'Pets',        emoji: '🐾', icon: 'paw-outline' },
  { id: 'food',        label: 'Food',        emoji: '🍲', icon: 'restaurant-outline' },
  { id: 'faith',       label: 'Faith',       emoji: '🙏', icon: 'heart-circle-outline' },
  { id: 'emergency',   label: 'Emergency',   emoji: '🚨', icon: 'alert-circle-outline' },
  { id: 'environment', label: 'Environment', emoji: '🌱', icon: 'leaf-outline' },
  { id: 'arts',        label: 'Arts',        emoji: '🎵', icon: 'musical-notes-outline' },
]

const OTHER_FUND_ICON_IDS = new Set(OTHER_FUND_ICON_OPTIONS.map(option => option.id))
const FUND_ICON_BY_EMOJI = new Map(
  [...EMOJI_OPTIONS, ...OTHER_FUND_ICON_OPTIONS].map(option => [option.emoji, option.icon] as const)
)

export function isOtherFundIcon(id: string) {
  return OTHER_FUND_ICON_IDS.has(id)
}

export function fundIconForEmoji(emoji: string): keyof typeof Ionicons.glyphMap {
  return FUND_ICON_BY_EMOJI.get(emoji) ?? 'wallet-outline'
}

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
  BWP: { name: 'Pula', symbol: 'P' },
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

export function resolveFundCurrency(preferredCurrency?: string | null): FundCurrency {
  const normalized = preferredCurrency?.trim().toUpperCase()
  return normalized && FUND_CURRENCIES.some(item => item.id === normalized) ? normalized : 'BWP'
}
