-- Keep the controlled category enum for reporting while retaining a reusable
-- user-provided label whenever an organiser selects Other.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS custom_category text;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_custom_category_check;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_custom_category_check
  CHECK (
    custom_category IS NULL
    OR (
      category = 'other'
      AND char_length(btrim(custom_category)) BETWEEN 2 AND 80
    )
  );
