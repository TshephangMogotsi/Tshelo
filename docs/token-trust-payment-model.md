# Tshelo token, trust-point, and payment model

## Decision

Tshelo uses two separate balances:

- **Tokens** are paid app credit. They are purchased with money and spent on clearly priced premium actions.
- **Trust points** are earned reputation. They cannot be purchased, transferred, redeemed, or converted to tokens or cash.

Achievements must never increase a user's paid-token balance. This keeps rewards useful for engagement without creating a financial liability for Tshelo.

## Trust-point schedule

The complete achievement path totals 100 points.

| Achievement | Requirement | Trust points |
| --- | --- | ---: |
| Profile Ready | Complete the Tshelo profile | 5 |
| Payment Identity Verified | Verify the registered mobile-money identity | 5 |
| First Contribution | Make a first confirmed contribution | 5 |
| Consistent Contributor | Contribute to 3 different funds | 10 |
| Community Pillar | Contribute to 10 different funds | 15 |
| Receipt Starter | Add valid receipts to 3 expenses | 5 |
| Transparent Organiser | Maintain at least 80% receipt coverage across 5 expenses | 15 |
| First Fund Completed | Close a first fund successfully | 10 |
| Reliable Organiser | Close 3 funds without unresolved disputes | 15 |
| Goal Getter | Lead a fund that reaches its target | 10 |
| Event Ready | Complete an event's date, time, venue, and guest list | 5 |
| **Total** |  | **100** |

Reports and flags can reduce the displayed trust score. Mobile-money verification remains required for the highest verified trust level.

## Revised pricing catalogue

The card-rail catalogue withdraws the four small token bundles. The client app
and member site display the public offers below, while the database owns the
codes a hosted checkout is allowed to fulfil.

| Offer | Checkout code | Price (BWP) | What it provides |
| --- | --- | ---: | --- |
| Token top-up | `top_up_60` | P50 | 60 tokens (P0.83 per token) |
| Unlimited | `unlimited_12m` | P300 / year | Dated pass for regular organisers |
| Committee | `committee_12m` | P750 / year | Dated pass for shared administration |

Unlimited includes unlimited funds and events (up to 25 active at once), up
to 100 members per fund, every report, Smart Plan, priority support, and
Verified badge eligibility. Committee includes Unlimited plus five shared
administrators, unlimited members, monthly statements, and an annual
general-meeting pack. Passes run for twelve months after confirmed payment and
do not renew automatically.

Institutional pricing is not a public checkout offer. It is invoiced annually
and starts at P100 per seat, with the final price set by covered-seat volume and
reporting obligations.

The catalogue records fixed BWP, ZAR, and USD price points for the payment
service. Do not activate a card or PayPal checkout until the client confirms
the settlement-currency policy: the pricing brief's Pula display figures and
its proposed USD charges are not simple conversions of each other.

Approved feature prices:

| Action | Token cost |
| --- | ---: |
| Create the first standalone event | Free |
| Create the first standalone fund | Free |
| Create each additional standalone event | 10 |
| Create each additional standalone fund | 10 |
| Create an Event + Fund | 15 |
| Members 21–50 | 15 per fund |
| Members 51–100 | 30 per fund |
| Members 101–250 | 60 per fund |
| Event guest list over 100 | 10 |
| Interim PDF | 3 |
| Certified audit | 10 |
| Year-end statement | 5 |
| Smart Plan | 8 |
| Vendor directory by region | 5 |
| Close a fund and receive its final audit PDF | Free |

Before public launch, confirm that each pack's payment price covers gateway costs, taxes, support costs, and the expected cost of every token-funded feature.

## Payment flow

1. The user selects a token top-up or annual pass in the app.
2. The app opens an HTTPS checkout page on the Tshelo website. It does not collect payment details itself.
3. The website requires the user to sign in and creates a server-owned payment order.
4. Orange Money, MyZaka, or the card gateway processes the payment.
5. A signed, verified, idempotent webhook confirms the payment to the Tshelo backend.
6. The backend validates the checkout code against `checkout_offerings` and records one `token_transactions` row with `transaction_type = 'purchase'` only for a token top-up. For an annual pass it grants the matching `user_entitlements` record with a twelve-month end date.
7. The database updates the user's token balance or entitlement and creates a purchase-confirmation notification.
8. Returning to the app refreshes the balance and pass status from the server.

The client must never be allowed to submit a token credit, choose the credited quantity, or mark its own payment successful. A provider transaction ID must be unique so retries cannot credit the same payment twice.

## Launch configuration

Set `EXPO_PUBLIC_TOKEN_PORTAL_URL` to the production HTTPS checkout address when the web portal is ready. The URL receives a `pack` query parameter containing one of the server-validated checkout codes above; it must never accept a client-provided amount, currency, token quantity, or entitlement type. Until the provider, webhook, and settlement-currency policy are configured, the app explains that web checkout is coming soon and does not imply that a payment was taken.

The one-time 100-token internal beta grant is visible only in development builds. It must be disabled at the backend before public launch.
