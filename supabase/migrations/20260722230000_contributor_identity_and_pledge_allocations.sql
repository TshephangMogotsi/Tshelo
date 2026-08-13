-- Give every financial record a stable, fund-scoped contributor identity.
-- Fund contributors do not grant fund access; fund_members remains the sole
-- source of membership and permissions.

CREATE OR REPLACE FUNCTION public.normalize_contributor_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(regexp_replace(COALESCE(p_phone, ''), '[^0-9]+', '', 'g')) = 11
      AND left(regexp_replace(COALESCE(p_phone, ''), '[^0-9]+', '', 'g'), 3) = '267'
      THEN right(regexp_replace(COALESCE(p_phone, ''), '[^0-9]+', '', 'g'), 8)
    ELSE regexp_replace(COALESCE(p_phone, ''), '[^0-9]+', '', 'g')
  END
$$;

CREATE TABLE public.fund_contributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  display_name varchar(100) NOT NULL,
  phone varchar(20) NOT NULL DEFAULT '',
  normalized_phone text NOT NULL DEFAULT '',
  contributor_type text NOT NULL CHECK (contributor_type IN ('member', 'guest')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fund_contributors IS
  'Financial identities scoped to one fund. A row may link to a member but never grants fund access.';
COMMENT ON COLUMN public.fund_contributors.user_id IS
  'Optional authenticated user link. Membership and permissions remain in fund_members.';

CREATE UNIQUE INDEX fund_contributors_member_unique
  ON public.fund_contributors (fund_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX fund_contributors_fund_name_idx
  ON public.fund_contributors (fund_id, lower(display_name));
CREATE INDEX fund_contributors_fund_phone_idx
  ON public.fund_contributors (fund_id, normalized_phone)
  WHERE normalized_phone <> '';

ALTER TABLE public.fund_contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY fund_contributors_select_member
  ON public.fund_contributors
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funds f
      WHERE f.id = fund_contributors.fund_id
        AND (
          f.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.fund_members fm
            WHERE fm.fund_id = fund_contributors.fund_id
              AND fm.user_id = auth.uid()
              AND fm.status = 'joined'::public.member_status
          )
        )
    )
  );

REVOKE ALL ON TABLE public.fund_contributors FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.fund_contributors TO authenticated;

ALTER TABLE public.contributions
  ADD COLUMN contributor_id uuid REFERENCES public.fund_contributors(id) ON DELETE RESTRICT;

-- Backfill member-linked contribution rows first. One member receives one
-- contributor identity per fund.
INSERT INTO public.fund_contributors (
  fund_id, user_id, display_name, phone, normalized_phone,
  contributor_type, created_by, created_at, updated_at
)
SELECT DISTINCT ON (c.fund_id, c.user_id)
  c.fund_id,
  c.user_id,
  c.contributor_name,
  c.contributor_phone,
  public.normalize_contributor_phone(c.contributor_phone),
  'member',
  c.tagged_by,
  c.created_at,
  c.updated_at
FROM public.contributions c
WHERE c.user_id IS NOT NULL
ORDER BY c.fund_id, c.user_id, c.created_at DESC;

UPDATE public.contributions c
SET contributor_id = fc.id
FROM public.fund_contributors fc
WHERE c.contributor_id IS NULL
  AND c.user_id IS NOT NULL
  AND fc.fund_id = c.fund_id
  AND fc.user_id = c.user_id;

-- Historical guest rows with the same normalized phone inside one fund are
-- grouped for migration. Names alone are never used for automatic matching.
INSERT INTO public.fund_contributors (
  fund_id, user_id, display_name, phone, normalized_phone,
  contributor_type, created_by, created_at, updated_at
)
SELECT DISTINCT ON (c.fund_id, public.normalize_contributor_phone(c.contributor_phone))
  c.fund_id,
  NULL,
  c.contributor_name,
  c.contributor_phone,
  public.normalize_contributor_phone(c.contributor_phone),
  'guest',
  c.tagged_by,
  c.created_at,
  c.updated_at
FROM public.contributions c
WHERE c.user_id IS NULL
  AND public.normalize_contributor_phone(c.contributor_phone) <> ''
ORDER BY c.fund_id, public.normalize_contributor_phone(c.contributor_phone), c.created_at DESC;

UPDATE public.contributions c
SET contributor_id = fc.id
FROM public.fund_contributors fc
WHERE c.contributor_id IS NULL
  AND c.user_id IS NULL
  AND fc.fund_id = c.fund_id
  AND fc.user_id IS NULL
  AND fc.normalized_phone = public.normalize_contributor_phone(c.contributor_phone)
  AND fc.normalized_phone <> '';

-- Preserve malformed legacy rows rather than failing the migration. Each
-- unmatched row receives its own contributor identity for later review.
DO $$
DECLARE
  contribution_row public.contributions%ROWTYPE;
  new_contributor_id uuid;
BEGIN
  FOR contribution_row IN
    SELECT * FROM public.contributions WHERE contributor_id IS NULL
  LOOP
    INSERT INTO public.fund_contributors (
      fund_id, user_id, display_name, phone, normalized_phone,
      contributor_type, created_by, created_at, updated_at
    ) VALUES (
      contribution_row.fund_id,
      contribution_row.user_id,
      contribution_row.contributor_name,
      contribution_row.contributor_phone,
      public.normalize_contributor_phone(contribution_row.contributor_phone),
      CASE WHEN contribution_row.user_id IS NULL THEN 'guest' ELSE 'member' END,
      contribution_row.tagged_by,
      contribution_row.created_at,
      contribution_row.updated_at
    )
    RETURNING id INTO new_contributor_id;

    UPDATE public.contributions
    SET contributor_id = new_contributor_id
    WHERE id = contribution_row.id;
  END LOOP;
END $$;

ALTER TABLE public.contributions
  ALTER COLUMN contributor_id SET NOT NULL;
CREATE INDEX contributions_contributor_idx
  ON public.contributions (contributor_id, created_at DESC);

-- A transaction may be corrected, but its financial identity is changed only
-- through the contributor profile/linking workflow.
REVOKE UPDATE ON TABLE public.contributions FROM anon, authenticated;
GRANT UPDATE (
  amount, pledged_amount, payment_method, reference_number, status,
  is_refunded, refunded_at, confirmed_by, confirmed_at, notes, updated_at
) ON public.contributions TO authenticated;

-- Resolve or create the contributor identity before the existing contribution
-- insert policy runs. A guest with no contributor_id is always a new explicit
-- guest; reuse only occurs when the app supplies a previously selected ID.
CREATE OR REPLACE FUNCTION public.ensure_contribution_contributor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contributor_row public.fund_contributors%ROWTYPE;
BEGIN
  IF NEW.contributor_id IS NOT NULL THEN
    SELECT * INTO contributor_row
    FROM public.fund_contributors
    WHERE id = NEW.contributor_id;

    IF NOT FOUND OR contributor_row.fund_id <> NEW.fund_id THEN
      RAISE EXCEPTION 'Contributor does not belong to this fund';
    END IF;

    NEW.user_id := contributor_row.user_id;
    NEW.contributor_name := contributor_row.display_name;
    NEW.contributor_phone := contributor_row.phone;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT * INTO contributor_row
    FROM public.fund_contributors
    WHERE fund_id = NEW.fund_id
      AND user_id = NEW.user_id;

    IF NOT FOUND THEN
      INSERT INTO public.fund_contributors (
        fund_id, user_id, display_name, phone, normalized_phone,
        contributor_type, created_by
      ) VALUES (
        NEW.fund_id,
        NEW.user_id,
        NEW.contributor_name,
        NEW.contributor_phone,
        public.normalize_contributor_phone(NEW.contributor_phone),
        'member',
        NEW.tagged_by
      )
      ON CONFLICT (fund_id, user_id) WHERE user_id IS NOT NULL DO NOTHING
      RETURNING * INTO contributor_row;

      IF NOT FOUND THEN
        SELECT * INTO contributor_row
        FROM public.fund_contributors
        WHERE fund_id = NEW.fund_id
          AND user_id = NEW.user_id;
      END IF;
    END IF;
  ELSE
    INSERT INTO public.fund_contributors (
      fund_id, user_id, display_name, phone, normalized_phone,
      contributor_type, created_by
    ) VALUES (
      NEW.fund_id,
      NULL,
      NEW.contributor_name,
      NEW.contributor_phone,
      public.normalize_contributor_phone(NEW.contributor_phone),
      'guest',
      NEW.tagged_by
    )
    RETURNING * INTO contributor_row;
  END IF;

  NEW.contributor_id := contributor_row.id;
  NEW.contributor_name := contributor_row.display_name;
  NEW.contributor_phone := contributor_row.phone;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_contribution_contributor() FROM PUBLIC;

CREATE TRIGGER ensure_contribution_contributor_before_insert
  BEFORE INSERT ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_contribution_contributor();

-- Payments remain separate contribution rows. Allocations connect received
-- money to the pledge it fulfils, supporting partial and excess payments.
CREATE TABLE public.pledge_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  contributor_id uuid NOT NULL REFERENCES public.fund_contributors(id) ON DELETE RESTRICT,
  pledge_contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  payment_contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pledge_allocations_distinct_rows
    CHECK (pledge_contribution_id <> payment_contribution_id),
  CONSTRAINT pledge_allocations_pair_unique
    UNIQUE (pledge_contribution_id, payment_contribution_id)
);

CREATE INDEX pledge_allocations_pledge_idx
  ON public.pledge_allocations (pledge_contribution_id);
CREATE INDEX pledge_allocations_payment_idx
  ON public.pledge_allocations (payment_contribution_id);
CREATE INDEX pledge_allocations_contributor_idx
  ON public.pledge_allocations (contributor_id, created_at DESC);

ALTER TABLE public.pledge_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY pledge_allocations_select_member
  ON public.pledge_allocations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funds f
      WHERE f.id = pledge_allocations.fund_id
        AND (
          f.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.fund_members fm
            WHERE fm.fund_id = pledge_allocations.fund_id
              AND fm.user_id = auth.uid()
              AND fm.status = 'joined'::public.member_status
          )
        )
    )
  );

CREATE POLICY pledge_allocations_insert_manager
  ON public.pledge_allocations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.funds f
      WHERE f.id = pledge_allocations.fund_id
        AND (
          f.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.fund_members fm
            WHERE fm.fund_id = f.id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner'::public.member_role, 'admin'::public.member_role)
              AND fm.status = 'joined'::public.member_status
          )
        )
    )
  );

REVOKE ALL ON TABLE public.pledge_allocations FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.pledge_allocations TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_pledge_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pledge_row public.contributions%ROWTYPE;
  payment_row public.contributions%ROWTYPE;
  pledge_allocated numeric(15,2);
  payment_allocated numeric(15,2);
BEGIN
  SELECT * INTO pledge_row
  FROM public.contributions
  WHERE id = NEW.pledge_contribution_id
  FOR UPDATE;

  SELECT * INTO payment_row
  FROM public.contributions
  WHERE id = NEW.payment_contribution_id
  FOR UPDATE;

  IF pledge_row.id IS NULL OR payment_row.id IS NULL THEN
    RAISE EXCEPTION 'Pledge or payment contribution was not found';
  END IF;
  IF pledge_row.status <> 'pledged'::public.contribution_status
     OR payment_row.status <> 'confirmed'::public.contribution_status THEN
    RAISE EXCEPTION 'Allocations require a pledged row and a confirmed payment row';
  END IF;
  IF pledge_row.fund_id <> payment_row.fund_id
     OR pledge_row.contributor_id <> payment_row.contributor_id
     OR NEW.fund_id <> pledge_row.fund_id
     OR NEW.contributor_id <> pledge_row.contributor_id THEN
    RAISE EXCEPTION 'Pledge and payment must belong to the same contributor and fund';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO pledge_allocated
  FROM public.pledge_allocations
  WHERE pledge_contribution_id = NEW.pledge_contribution_id
    AND id IS DISTINCT FROM NEW.id;

  SELECT COALESCE(sum(amount), 0) INTO payment_allocated
  FROM public.pledge_allocations
  WHERE payment_contribution_id = NEW.payment_contribution_id
    AND id IS DISTINCT FROM NEW.id;

  IF pledge_allocated + NEW.amount > COALESCE(pledge_row.pledged_amount, pledge_row.amount) THEN
    RAISE EXCEPTION 'Allocation exceeds the pledge outstanding amount';
  END IF;
  IF payment_allocated + NEW.amount > payment_row.amount THEN
    RAISE EXCEPTION 'Allocation exceeds the received payment amount';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_pledge_allocation() FROM PUBLIC;

CREATE TRIGGER validate_pledge_allocation_before_write
  BEFORE INSERT OR UPDATE ON public.pledge_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_pledge_allocation();

CREATE OR REPLACE FUNCTION public.auto_allocate_contribution_to_pledge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_pledge_count integer;
  open_pledge_id uuid;
  open_pledge_outstanding numeric(15,2);
BEGIN
  IF NEW.status <> 'confirmed'::public.contribution_status
     OR COALESCE(NEW.is_refunded, false)
     OR NEW.contributor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    count(*),
    (array_agg(pledge_id))[1],
    (array_agg(outstanding))[1]
  INTO open_pledge_count, open_pledge_id, open_pledge_outstanding
  FROM (
    SELECT
      pledge.id AS pledge_id,
      COALESCE(pledge.pledged_amount, pledge.amount)
        - COALESCE(sum(allocation.amount), 0) AS outstanding
    FROM public.contributions pledge
    LEFT JOIN public.pledge_allocations allocation
      ON allocation.pledge_contribution_id = pledge.id
    WHERE pledge.fund_id = NEW.fund_id
      AND pledge.contributor_id = NEW.contributor_id
      AND pledge.status = 'pledged'::public.contribution_status
      AND COALESCE(pledge.is_refunded, false) = false
    GROUP BY pledge.id
    HAVING COALESCE(pledge.pledged_amount, pledge.amount)
      - COALESCE(sum(allocation.amount), 0) > 0
  ) open_pledges;

  IF open_pledge_count = 1 THEN
    -- Serialize concurrent receipts for the same pledge, then refresh the
    -- remaining balance before creating the allocation.
    PERFORM 1
    FROM public.contributions
    WHERE id = open_pledge_id
    FOR UPDATE;

    SELECT
      COALESCE(pledge.pledged_amount, pledge.amount)
        - COALESCE(sum(allocation.amount), 0)
    INTO open_pledge_outstanding
    FROM public.contributions pledge
    LEFT JOIN public.pledge_allocations allocation
      ON allocation.pledge_contribution_id = pledge.id
    WHERE pledge.id = open_pledge_id
    GROUP BY pledge.id;

    IF open_pledge_outstanding <= 0 THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.pledge_allocations (
      fund_id, contributor_id, pledge_contribution_id,
      payment_contribution_id, amount, created_by
    ) VALUES (
      NEW.fund_id,
      NEW.contributor_id,
      open_pledge_id,
      NEW.id,
      LEAST(NEW.amount, open_pledge_outstanding),
      COALESCE(NEW.confirmed_by, NEW.tagged_by)
    )
    ON CONFLICT (pledge_contribution_id, payment_contribution_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_allocate_contribution_to_pledge() FROM PUBLIC;

CREATE TRIGGER auto_allocate_contribution_after_insert
  AFTER INSERT ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.auto_allocate_contribution_to_pledge();

CREATE VIEW public.contributor_pledge_balances
WITH (security_invoker = true)
AS
SELECT
  pledge.id AS pledge_id,
  pledge.fund_id,
  pledge.contributor_id,
  pledge.contributor_name,
  COALESCE(pledge.pledged_amount, pledge.amount) AS pledged_amount,
  COALESCE(sum(allocation.amount), 0)::numeric(15,2) AS allocated_amount,
  (
    COALESCE(pledge.pledged_amount, pledge.amount)
      - COALESCE(sum(allocation.amount), 0)
  )::numeric(15,2) AS outstanding_amount,
  CASE
    WHEN COALESCE(sum(allocation.amount), 0) = 0 THEN 'pledged'
    WHEN COALESCE(sum(allocation.amount), 0) >= COALESCE(pledge.pledged_amount, pledge.amount) THEN 'fulfilled'
    ELSE 'partially_paid'
  END AS pledge_state,
  pledge.created_at
FROM public.contributions pledge
LEFT JOIN public.pledge_allocations allocation
  ON allocation.pledge_contribution_id = pledge.id
WHERE pledge.status = 'pledged'::public.contribution_status
  AND COALESCE(pledge.is_refunded, false) = false
GROUP BY pledge.id;

REVOKE ALL ON TABLE public.contributor_pledge_balances FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.contributor_pledge_balances TO authenticated;

-- contributor_id is an ownership field and must not be changed after insert.
CREATE OR REPLACE FUNCTION public.enforce_financial_row_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allocated_to_pledge numeric(15,2);
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'contributions' THEN
    IF NEW.fund_id IS DISTINCT FROM OLD.fund_id
       OR NEW.tagged_by IS DISTINCT FROM OLD.tagged_by
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.contributor_id IS DISTINCT FROM OLD.contributor_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Contribution ownership fields cannot be changed';
    END IF;
    IF NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
       AND NEW.confirmed_by IS NOT NULL
       AND NEW.confirmed_by <> auth.uid() THEN
      RAISE EXCEPTION 'Contribution confirmation cannot be attributed to another user';
    END IF;
    IF NEW.refund_confirmed_by IS DISTINCT FROM OLD.refund_confirmed_by
       AND NEW.refund_confirmed_by IS NOT NULL
       AND NEW.refund_confirmed_by <> auth.uid() THEN
      RAISE EXCEPTION 'Refund confirmation cannot be attributed to another user';
    END IF;
    IF OLD.status = 'pledged'::public.contribution_status
       AND (
         NEW.pledged_amount IS DISTINCT FROM OLD.pledged_amount
         OR NEW.amount IS DISTINCT FROM OLD.amount
       ) THEN
      SELECT COALESCE(sum(amount), 0)
      INTO allocated_to_pledge
      FROM public.pledge_allocations
      WHERE pledge_contribution_id = OLD.id;

      IF COALESCE(NEW.pledged_amount, NEW.amount) < allocated_to_pledge THEN
        RAISE EXCEPTION 'Pledge amount cannot be lower than money already allocated';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    IF NEW.fund_id IS DISTINCT FROM OLD.fund_id
       OR NEW.added_by IS DISTINCT FROM OLD.added_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Expense ownership fields cannot be changed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
