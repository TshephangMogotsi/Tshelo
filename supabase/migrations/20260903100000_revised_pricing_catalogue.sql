-- Revised consumer catalogue for the card and PayPal launch rail.
--
-- This records what checkout is allowed to sell. A hosted checkout must still
-- select its final settlement currency, create an order server-side, and grant
-- tokens or a pass only from a verified, idempotent payment webhook.

CREATE TABLE IF NOT EXISTS public.checkout_offerings (
  offer_code character varying(50) PRIMARY KEY,
  offer_type character varying(30) NOT NULL
    CHECK (offer_type IN ('token_top_up', 'annual_pass', 'institutional_seat')),
  display_name character varying(100) NOT NULL,
  description text,
  token_quantity integer NOT NULL DEFAULT 0 CHECK (token_quantity >= 0),
  entitlement_type character varying(50),
  term_months integer,
  price_bwp numeric(10,2) NOT NULL CHECK (price_bwp >= 0),
  price_zar numeric(10,2) NOT NULL CHECK (price_zar >= 0),
  price_usd numeric(10,2) NOT NULL CHECK (price_usd >= 0),
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (
    (offer_type = 'token_top_up' AND token_quantity > 0 AND entitlement_type IS NULL AND term_months IS NULL)
    OR (offer_type = 'annual_pass' AND token_quantity = 0 AND entitlement_type IS NOT NULL AND term_months = 12)
    OR (offer_type = 'institutional_seat' AND token_quantity = 0 AND entitlement_type IS NOT NULL AND term_months = 12)
  )
);

ALTER TABLE public.checkout_offerings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_offerings_select_public ON public.checkout_offerings;
CREATE POLICY checkout_offerings_select_public
  ON public.checkout_offerings
  FOR SELECT TO public
  USING (is_active AND is_public);

INSERT INTO public.checkout_offerings (
  offer_code,
  offer_type,
  display_name,
  description,
  token_quantity,
  entitlement_type,
  term_months,
  price_bwp,
  price_zar,
  price_usd,
  is_public,
  is_active,
  sort_order
)
VALUES
  (
    'top_up_60',
    'token_top_up',
    'Token top-up',
    '60 tokens for additional features.',
    60,
    NULL,
    NULL,
    50.00,
    89.00,
    15.00,
    true,
    true,
    10
  ),
  (
    'unlimited_12m',
    'annual_pass',
    'Unlimited',
    'A dated 12-month pass for regular organisers.',
    0,
    'pass_unlimited_12m',
    12,
    300.00,
    499.00,
    49.00,
    true,
    true,
    20
  ),
  (
    'committee_12m',
    'annual_pass',
    'Committee',
    'A dated 12-month pass for shared fund administration.',
    0,
    'pass_committee_12m',
    12,
    750.00,
    1249.00,
    119.00,
    true,
    true,
    30
  ),
  (
    'institutional_seat_12m',
    'institutional_seat',
    'Institutional annual seat',
    'Internal floor price only; sold by annual invoice, never public checkout.',
    0,
    'institutional_seat_12m',
    12,
    100.00,
    0.00,
    0.00,
    false,
    true,
    40
  )
ON CONFLICT (offer_code) DO UPDATE SET
  offer_type = EXCLUDED.offer_type,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  token_quantity = EXCLUDED.token_quantity,
  entitlement_type = EXCLUDED.entitlement_type,
  term_months = EXCLUDED.term_months,
  price_bwp = EXCLUDED.price_bwp,
  price_zar = EXCLUDED.price_zar,
  price_usd = EXCLUDED.price_usd,
  is_public = EXCLUDED.is_public,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- `payments.bundle_code` retains its existing foreign key to token_bundles,
-- so the one credit product remains there too. Passes are fulfilled as
-- entitlements from checkout_offerings, not as zero-token bundles.
INSERT INTO public.token_bundles (
  bundle_code,
  bundle_name,
  tokens,
  price_bwp,
  price_zar,
  price_usd,
  bonus_percentage,
  is_active,
  sort_order
)
VALUES (
  'top_up_60',
  'Token top-up',
  60,
  50.00,
  89.00,
  15.00,
  0,
  true,
  10
)
ON CONFLICT (bundle_code) DO UPDATE SET
  bundle_name = EXCLUDED.bundle_name,
  tokens = EXCLUDED.tokens,
  price_bwp = EXCLUDED.price_bwp,
  price_zar = EXCLUDED.price_zar,
  price_usd = EXCLUDED.price_usd,
  bonus_percentage = EXCLUDED.bonus_percentage,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Preserve historical payment references while withdrawing the superseded
-- packs from every active catalogue query.
UPDATE public.token_bundles
SET is_active = false,
    updated_at = now()
WHERE bundle_code IN ('starter', 'value', 'popular', 'power');

COMMENT ON TABLE public.checkout_offerings IS
  'Server-owned checkout catalogue. Hosted checkout validates offer codes here before charging or granting access.';
