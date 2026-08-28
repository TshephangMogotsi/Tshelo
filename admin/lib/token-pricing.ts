import {
  TOKEN_FEATURE_PRICES,
  TOKEN_PACKS,
  tokenPriceLabel,
  type TokenPack,
  type TokenPackId,
} from '../../lib/tokenPricing'

export {
  TOKEN_FEATURE_PRICES,
  TOKEN_PACKS,
  tokenPriceLabel,
  type TokenPack,
  type TokenPackId,
}

/**
 * Checkout is hosted separately so that card and mobile-money details never
 * pass through the member website. The checkout service must validate the
 * selected pack against its own server-owned catalogue.
 */
export function buildTokenCheckoutUrl(baseUrl: string | undefined, packId: TokenPackId) {
  if (!baseUrl) return null

  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:') return null
    url.searchParams.set('pack', packId)
    url.searchParams.set('source', 'web')
    return url.toString()
  } catch {
    return null
  }
}
