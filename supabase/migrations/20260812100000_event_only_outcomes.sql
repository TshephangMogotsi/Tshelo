-- Event-only records do not track line-item expenses. When an organiser closes
-- one, capture an optional high-level estimate for aggregate product insights.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS estimated_spend_amount numeric(15,2);

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_estimated_spend_amount_nonnegative;

ALTER TABLE public.events
  ADD CONSTRAINT events_estimated_spend_amount_nonnegative
  CHECK (estimated_spend_amount IS NULL OR estimated_spend_amount >= 0);

COMMENT ON COLUMN public.events.estimated_spend_amount IS
  'Optional organiser estimate captured when an event-only record is completed; not an expense ledger.';
