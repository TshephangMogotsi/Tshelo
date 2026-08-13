-- Align the server-owned pricing catalogue with the client pricing brief
-- dated 12 August 2026. Checkout must still validate prices on the server;
-- the mobile app's displayed values are not payment authority.

INSERT INTO public.token_bundles (
  bundle_code,
  bundle_name,
  tokens,
  price_bwp,
  bonus_percentage,
  is_active,
  sort_order
)
VALUES
  ('starter', 'Starter', 10, 5.00, 0, true, 1),
  ('value', 'Value', 30, 13.00, 0, true, 2),
  ('popular', 'Popular', 60, 24.00, 0, true, 3),
  ('power', 'Power', 120, 45.00, 0, true, 4)
ON CONFLICT (bundle_code) DO UPDATE SET
  bundle_name = EXCLUDED.bundle_name,
  tokens = EXCLUDED.tokens,
  price_bwp = EXCLUDED.price_bwp,
  bonus_percentage = EXCLUDED.bonus_percentage,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.token_products (
  product_code,
  product_name,
  description,
  token_cost,
  entitlement_type,
  entitlement_quantity,
  is_reward,
  is_active,
  sort_order
)
VALUES
  ('extra_fund', 'Additional Fund', 'Create another fund after the first free fund', 10, 'fund', 1, false, true, 10),
  ('extra_event', 'Additional Event', 'Create another event after the first free event', 10, 'event', 1, false, true, 20),
  ('create_event_fund_combo', 'Event + Fund Combo', 'Create a linked event and fund together', 15, 'event_fund_combo', 1, false, true, 30),
  ('members_21_50', 'Members 21–50', 'Increase one fund to a maximum of 50 members', 15, 'members', 50, false, true, 40),
  ('members_51_100', 'Members 51–100', 'Increase one fund to a maximum of 100 members', 30, 'members', 100, false, true, 50),
  ('members_101_250', 'Members 101–250', 'Increase one fund to a maximum of 250 members', 60, 'members', 250, false, true, 60),
  ('event_guests_over_100', 'Event Guests Over 100', 'Increase an event guest list beyond 100 guests', 10, 'event_guests', 1, false, true, 70),
  ('interim_pdf', 'Interim PDF', 'Generate an interim fund report', 3, 'report', 1, false, true, 80),
  ('certified_audit', 'Certified Audit', 'Generate a certified audit report', 10, 'report', 1, false, true, 90),
  ('year_end_statement', 'Year-end Statement', 'Generate a year-end statement', 5, 'report', 1, false, true, 100),
  ('smart_plan', 'Smart Plan', 'Unlock a Smart Plan', 8, 'planning', 1, false, true, 110),
  ('vendor_directory_region', 'Vendor Directory', 'Unlock the vendor directory for one region', 5, 'vendor_directory', 1, false, true, 120)
ON CONFLICT (product_code) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  description = EXCLUDED.description,
  token_cost = EXCLUDED.token_cost,
  entitlement_type = EXCLUDED.entitlement_type,
  entitlement_quantity = EXCLUDED.entitlement_quantity,
  is_reward = EXCLUDED.is_reward,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- Retire superseded beta catalogue rows so users never see conflicting
-- member and export prices. Historical transactions keep their product code.
UPDATE public.token_products
SET is_active = false
WHERE product_code IN (
  'additional_fund',
  'extra_export',
  'members_25',
  'members_50',
  'members_unlimited'
);
