'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Check, Coins, FileText, HandCoins, ShieldCheck } from 'lucide-react'
import {
  CHECKOUT_OFFERS,
  TOKEN_FEATURE_PRICES,
  buildTokenCheckoutUrl,
  isTokenPack,
  tokenPriceLabel,
  type CheckoutOfferId,
} from '@/lib/token-pricing'

const tokenUses = [
  { icon: HandCoins, label: 'Create an Event + Fund', cost: TOKEN_FEATURE_PRICES.eventFund },
  { icon: CalendarDays, label: 'Additional event or fund', cost: TOKEN_FEATURE_PRICES.additionalFund },
  { icon: FileText, label: 'Interim PDF report', cost: TOKEN_FEATURE_PRICES.interimPdf },
  { icon: ShieldCheck, label: 'Certified audit report', cost: TOKEN_FEATURE_PRICES.certifiedAudit },
] as const

type Props = {
  tokenBalance: number
  checkoutBaseUrl?: string
}

export function TokenPurchase({ tokenBalance, checkoutBaseUrl }: Props) {
  const [selectedOfferId, setSelectedOfferId] = useState<CheckoutOfferId>('top_up_60')
  const selectedOffer = CHECKOUT_OFFERS.find((offer) => offer.id === selectedOfferId) ?? CHECKOUT_OFFERS[0]
  const selectedIsTopUp = isTokenPack(selectedOffer)
  const checkoutUrl = useMemo(
    () => buildTokenCheckoutUrl(checkoutBaseUrl, selectedOffer.id),
    [checkoutBaseUrl, selectedOffer.id],
  )

  return (
    <>
      <section className="member-pagehead">
        <div>
          <h1>Tshelo <em>pricing</em></h1>
        </div>
        <div className="member-token-balance" aria-label={`Current balance: ${tokenBalance} tokens`}>
          <Coins size={18} aria-hidden="true" />
          <span>Current balance</span>
          <strong>{tokenBalance.toLocaleString('en-BW')} tokens</strong>
        </div>
      </section>

      <section className="member-token-layout">
        <div>
          <section className="member-card member-token-uses">
            <header><div className="member-section-title"><span><Coins size={18} /></span><h2>What tokens unlock</h2></div></header>
            <div className="member-card-body">
              <ul>
                {tokenUses.map(({ icon: Icon, label, cost }) => (
                  <li key={label}><Icon size={17} aria-hidden="true" /><span>{label}</span><strong>{cost} tokens</strong></li>
                ))}
              </ul>
              <p>First standalone event and fund, plus the final fund report, are always free.</p>
            </div>
          </section>

          <section aria-labelledby="token-packs-heading">
            <div className="member-token-section-heading">
              <h2 id="token-packs-heading">Choose an option</h2>
              <span>Prices shown in Botswana pula</span>
            </div>
            <div className="member-token-pack-grid" role="radiogroup" aria-label="Token pack">
              {CHECKOUT_OFFERS.map((offer) => {
                const selected = offer.id === selectedOfferId
                const isTopUp = isTokenPack(offer)
                return (
                  <button
                    type="button"
                    key={offer.id}
                    className={selected ? 'selected' : undefined}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedOfferId(offer.id)}
                  >
                    <span className="member-token-pack-head"><strong>{offer.label}</strong><i aria-hidden="true"><Check size={13} /></i></span>
                    <span className="member-token-pack-value">
                      <b>{isTopUp ? offer.tokens : '12'}</b> {isTopUp ? 'tokens' : 'months'}
                    </span>
                    <span className="member-token-pack-price">P{offer.priceBWP.toFixed(2)}</span>
                    <small>{isTopUp ? `${tokenPriceLabel(offer.priceBWP, offer.tokens)} · ` : ''}{offer.description}</small>
                    {!isTopUp && <small className="member-token-pass-term">{offer.termLabel}</small>}
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="member-token-summary" aria-label="Order summary">
          <span>Order summary</span>
          <h2>{selectedOffer.label}{selectedIsTopUp ? ' top-up' : ' pass'}</h2>
          <dl>
            <div><dt>{selectedIsTopUp ? 'Tokens' : 'Term'}</dt><dd>{selectedIsTopUp ? selectedOffer.tokens : '12 months'}</dd></div>
            <div><dt>Price</dt><dd>P{selectedOffer.priceBWP.toFixed(2)}</dd></div>
            {selectedIsTopUp ? (
              <div className="member-token-total"><dt>Balance after confirmation</dt><dd>{(tokenBalance + selectedOffer.tokens).toLocaleString('en-BW')} tokens</dd></div>
            ) : (
              <div className="member-token-total"><dt>Pass term</dt><dd>Starts after confirmation. No automatic renewal.</dd></div>
            )}
          </dl>
          {checkoutUrl ? (
            <a className="member-token-checkout" href={checkoutUrl} rel="noreferrer">Continue to secure checkout · P{selectedOffer.priceBWP.toFixed(2)}</a>
          ) : (
            <p className="member-token-unavailable" role="status">Secure checkout is being activated. No payment has been taken.</p>
          )}
          <p className="member-token-security"><ShieldCheck size={15} aria-hidden="true" /> Your balance updates only after the payment provider confirms the order.</p>
        </aside>
      </section>
    </>
  )
}
