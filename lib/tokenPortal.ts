import type { CheckoutOfferId } from './tokenPricing'

export const TOKEN_PORTAL_URL = process.env.EXPO_PUBLIC_TOKEN_PORTAL_URL?.trim() ?? ''

export function buildTokenPortalUrl(baseUrl: string, offerCode: CheckoutOfferId): string | null {
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:') return null
    // `pack` is retained for the hosted checkout's existing URL contract. Its
    // value is a server-validated offer code, never a client-supplied amount.
    url.searchParams.set('pack', offerCode)
    url.searchParams.set('source', 'app')
    return url.toString()
  } catch {
    return null
  }
}
