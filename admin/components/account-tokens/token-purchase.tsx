'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Check, Coins, FileText, HandCoins, ShieldCheck } from 'lucide-react'
import {
  TOKEN_FEATURE_PRICES,
  TOKEN_PACKS,
  buildTokenCheckoutUrl,
  tokenPriceLabel,
  type TokenPackId,
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
  const [selectedPackId, setSelectedPackId] = useState<TokenPackId>('popular')
  const selectedPack = TOKEN_PACKS.find((pack) => pack.id === selectedPackId) ?? TOKEN_PACKS[0]
  const checkoutUrl = useMemo(
    () => buildTokenCheckoutUrl(checkoutBaseUrl, selectedPack.id),
    [checkoutBaseUrl, selectedPack.id],
  )

  return (
    <>
      <section className="member-pagehead">
        <div>
          <h1>Buy <em>tokens</em></h1>
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
              <h2 id="token-packs-heading">Choose a pack</h2>
              <span>All prices in Botswana pula</span>
            </div>
            <div className="member-token-pack-grid" role="radiogroup" aria-label="Token pack">
              {TOKEN_PACKS.map((pack) => {
                const selected = pack.id === selectedPackId
                return (
                  <button
                    type="button"
                    key={pack.id}
                    className={selected ? 'selected' : undefined}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedPackId(pack.id)}
                  >
                    {pack.popular && <span className="member-token-popular">Most popular</span>}
                    <span className="member-token-pack-head"><strong>{pack.label}</strong><i aria-hidden="true"><Check size={13} /></i></span>
                    <span className="member-token-pack-value"><b>{pack.tokens}</b> tokens</span>
                    <span className="member-token-pack-price">P{pack.priceBWP.toFixed(2)}</span>
                    <small>{tokenPriceLabel(pack.priceBWP, pack.tokens)} · {pack.description}</small>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="member-token-summary" aria-label="Order summary">
          <span>Order summary</span>
          <h2>{selectedPack.label} pack</h2>
          <dl>
            <div><dt>Tokens</dt><dd>{selectedPack.tokens}</dd></div>
            <div><dt>Price</dt><dd>P{selectedPack.priceBWP.toFixed(2)}</dd></div>
            <div className="member-token-total"><dt>Balance after confirmation</dt><dd>{(tokenBalance + selectedPack.tokens).toLocaleString('en-BW')} tokens</dd></div>
          </dl>
          {checkoutUrl ? (
            <a className="member-token-checkout" href={checkoutUrl} rel="noreferrer">Continue to secure checkout · P{selectedPack.priceBWP.toFixed(2)}</a>
          ) : (
            <p className="member-token-unavailable" role="status">Secure checkout is being activated. No payment has been taken.</p>
          )}
          <p className="member-token-security"><ShieldCheck size={15} aria-hidden="true" /> Your balance updates only after the payment provider confirms the order.</p>
        </aside>
      </section>
    </>
  )
}
