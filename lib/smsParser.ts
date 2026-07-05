import { MobileMoneyProvider } from './providers'

// Parses Botswana mobile-money SMS notifications into structured data.
// Pure text-in/data-out so it runs identically on Android (SMS intake),
// iOS (paste-to-parse), and in tests.
//
// ⚠️ The message formats below are PROVISIONAL — modelled on typical
// mobile-money SMS shapes. Verify against real Orange Money / MyZaka /
// Smega messages and adjust the patterns + test fixtures to match.

export type ParsedMobileMoneySms = {
  provider:          MobileMoneyProvider
  direction:         'received' | 'sent'
  amount:            number        // in Pula
  counterpartyName:  string | null
  counterpartyPhone: string | null
  reference:         string | null
  balance:           number | null // in Pula
}

const PROVIDER_HINTS: { provider: MobileMoneyProvider; pattern: RegExp }[] = [
  { provider: 'orange_money', pattern: /orange\s*money|orangemoney|\bOM\b/i },
  { provider: 'myzaka',       pattern: /myzaka|my\s*zaka|mascom/i },
  { provider: 'smega',        pattern: /smega|\bBTC\b/i },
]

// Money tokens: "P500.00", "P 1,250.50", "500.00 BWP", "BWP500", "Pula 500"
const MONEY = String.raw`(?:(?:BWP|P|Pula)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:BWP|Pula))`

const RECEIVED_RE = new RegExp(String.raw`(?:received|credited\s+with)\s+${MONEY}|${MONEY}\s+(?:received|credited)`, 'i')
const SENT_RE     = new RegExp(String.raw`(?:sent|paid|transferred)\s+${MONEY}|${MONEY}\s+(?:sent|paid|transferred)`, 'i')
const BALANCE_RE  = new RegExp(String.raw`bal(?:ance)?\s*(?:is|:)?\s*${MONEY}`, 'i')
const ANY_MONEY_RE = new RegExp(MONEY, 'i')

// Botswana MSISDN with optional country code, tolerating spaces/dashes
// between any digits (e.g. "71234567", "72 345 678", "+267 77 123 456")
const PHONE_RE = /(?:\+?267[\s-]?)?(7[1-7](?:[\s-]?\d){6})/

// "from KGOSI MOENG", "to Naledi Phiri" — a run of letters before the
// phone number, reference, or sentence end
const NAME_RE = /\b(?:from|to)\s+(?:\+?267[\s-]?)?(?:7[1-7][\d\s-]{6,10}\s+)?([A-Za-z][A-Za-z' ]{1,40}?)(?=\s*(?:\+?267|7[1-7]\d|[.,(]|Ref\b|Txn\b|Transaction\b|on\b|at\b|$))/i

// Token must end alphanumeric so a sentence-ending period isn't captured
const REFERENCE_RE = /(?:ref(?:erence)?|txn(?:\s*id)?|transaction\s*id|receipt(?:\s*no)?)\s*[:.]?\s*([A-Za-z0-9](?:[A-Za-z0-9.\-/]{1,22}[A-Za-z0-9])?)/i

function parseMoney(match: RegExpMatchArray | null): number | null {
  if (!match) return null
  const raw = match.slice(1).find(group => group !== undefined)
  if (!raw) return null
  const value = parseFloat(raw.replace(/,/g, ''))
  return isNaN(value) || value <= 0 ? null : value
}

function cleanPhone(raw: string): string {
  return raw.replace(/[\s-]/g, '')
}

// `senderHint` is the SMS sender ID (e.g. "OrangeMoney") when available —
// it takes priority over keywords in the body.
export function parseMobileMoneySms(
  text: string,
  senderHint?: string,
): ParsedMobileMoneySms | null {
  const body = text.replace(/\s+/g, ' ').trim()
  if (!body) return null

  const provider =
    PROVIDER_HINTS.find(hint => senderHint && hint.pattern.test(senderHint))?.provider ??
    PROVIDER_HINTS.find(hint => hint.pattern.test(body))?.provider ??
    null
  if (!provider) return null

  const receivedMatch = body.match(RECEIVED_RE)
  const sentMatch     = receivedMatch ? null : body.match(SENT_RE)
  const direction     = receivedMatch ? 'received' : sentMatch ? 'sent' : null
  if (!direction) return null

  // Balance often shares a money token shape with the amount — strip the
  // balance clause before falling back to "any money token"
  const balanceMatch = body.match(BALANCE_RE)
  const balance      = parseMoney(balanceMatch)
  const bodyNoBalance = balanceMatch ? body.replace(balanceMatch[0], ' ') : body

  const amount = parseMoney(receivedMatch ?? sentMatch) ?? parseMoney(bodyNoBalance.match(ANY_MONEY_RE))
  if (!amount) return null

  const phoneMatch = body.match(PHONE_RE)
  const nameMatch  = body.match(NAME_RE)
  const refMatch   = body.match(REFERENCE_RE)

  return {
    provider,
    direction,
    amount,
    counterpartyName:  nameMatch ? nameMatch[1].trim() : null,
    counterpartyPhone: phoneMatch ? cleanPhone(phoneMatch[1]) : null,
    reference:         refMatch ? refMatch[1] : null,
    balance,
  }
}
