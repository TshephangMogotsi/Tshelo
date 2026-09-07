import {
  ANNUAL_PASSES,
  CHECKOUT_OFFERS,
  TOKEN_FEATURE_PRICES,
  TOKEN_PACKS,
  isTokenPack,
  tokenPriceLabel,
  type AnnualPass,
  type AnnualPassId,
  type CheckoutOffer,
  type CheckoutOfferId,
  type TokenPack,
  type TokenPackId,
} from '../../lib/tokenPricing'

export {
  ANNUAL_PASSES,
  CHECKOUT_OFFERS,
  TOKEN_FEATURE_PRICES,
  TOKEN_PACKS,
  isTokenPack,
  tokenPriceLabel,
  type AnnualPass,
  type AnnualPassId,
  type CheckoutOffer,
  type CheckoutOfferId,
  type TokenPack,
  type TokenPackId,
}

/**
 * Checkout is hosted separately so that card and mobile-money details never
 * pass through the member website. The checkout service must validate the
 * selected pack against its own server-owned catalogue.
 */
export function buildTokenCheckoutUrl(baseUrl: string | undefined, offerId: CheckoutOfferId) {
  if (!baseUrl) return null

  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:') return null
    // The checkout service owns the catalogue and must validate this code
    // against it before creating a payment order.
    url.searchParams.set('pack', offerId)
    url.searchParams.set('source', 'web')
    return url.toString()
  } catch {
    return null
  }
}
