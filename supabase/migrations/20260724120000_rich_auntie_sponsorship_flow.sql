-- Rich Auntie sponsorship flow
--
-- A sponsorship item is an organiser-created, member-visible portion of the
-- existing fund goal. One joined member may claim the full item. Confirmed
-- contributions can then be allocated to it in one or more instalments.
-- Recognition is stored separately so the accounting record remains factual
-- even when an organiser chooses not to award a badge.

CREATE TABLE public.fund_sponsorship_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL CHECK (length(btrim(title)) >= 2),
  description varchar(500),
  category public.expense_category,
  target_amount numeric(15,2) NOT NULL CHECK (target_amount > 0),
  status varchar(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'claimed', 'funded', 'fulfilled', 'cancelled')),
  created_by uuid NOT NULL REFERENCES public.users(id),
  claimed_by_user_id uuid REFERENCES public.users(id),
  claimed_at timestamptz,
  funded_at timestamptz,
  fulfilled_at timestamptz,
  linked_expense_id uuid REFERENCES public.expenses(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fund_sponsorship_items_claim_state CHECK (
    (status IN ('open', 'cancelled') AND claimed_by_user_id IS NULL)
    OR
    (status IN ('claimed', 'funded', 'fulfilled') AND claimed_by_user_id IS NOT NULL)
  )
);

CREATE INDEX fund_sponsorship_items_fund_idx
  ON public.fund_sponsorship_items (fund_id, status, created_at);
CREATE INDEX fund_sponsorship_items_sponsor_idx
  ON public.fund_sponsorship_items (claimed_by_user_id, status);

CREATE TABLE public.sponsorship_item_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  sponsorship_item_id uuid NOT NULL
    REFERENCES public.fund_sponsorship_items(id) ON DELETE CASCADE,
  contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsorship_item_allocations_contribution_unique UNIQUE (contribution_id)
);

CREATE INDEX sponsorship_item_allocations_item_idx
  ON public.sponsorship_item_allocations (sponsorship_item_id, created_at);

CREATE TABLE public.rich_auntie_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  sponsorship_item_id uuid REFERENCES public.fund_sponsorship_items(id) ON DELETE SET NULL,
  reason_code varchar(50) NOT NULL CHECK (
    reason_code IN (
      'bought_outfit',
      'paid_catering',
      'covered_tent',
      'bought_cake',
      'major_contribution',
      'transport_costs',
      'custom'
    )
  ),
  reason_label varchar(200) NOT NULL CHECK (length(btrim(reason_label)) >= 2),
  awarded_by uuid NOT NULL REFERENCES public.users(id),
  notify_member boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rich_auntie_awards_recipient_idx
  ON public.rich_auntie_awards (recipient_user_id, created_at DESC);
CREATE INDEX rich_auntie_awards_fund_idx
  ON public.rich_auntie_awards (fund_id, created_at DESC);
CREATE UNIQUE INDEX rich_auntie_awards_item_unique
  ON public.rich_auntie_awards (sponsorship_item_id)
  WHERE sponsorship_item_id IS NOT NULL;

COMMENT ON TABLE public.fund_sponsorship_items IS
  'Organiser-created portions of a fund goal that one joined member can claim.';
COMMENT ON TABLE public.sponsorship_item_allocations IS
  'Confirmed contribution money allocated to a claimed sponsorship item.';
COMMENT ON TABLE public.rich_auntie_awards IS
  'Recognition awarded independently from the underlying contribution or expense accounting.';

ALTER TABLE public.fund_sponsorship_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_item_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rich_auntie_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY fund_sponsorship_items_select_member
  ON public.fund_sponsorship_items
  FOR SELECT TO authenticated
  USING (public.is_fund_owner(fund_id) OR public.is_fund_member(fund_id));

CREATE POLICY fund_sponsorship_items_insert_manager
  ON public.fund_sponsorship_items
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND status = 'open'
    AND claimed_by_user_id IS NULL
    AND (public.is_fund_owner(fund_id) OR public.is_fund_admin(fund_id))
  );

CREATE POLICY fund_sponsorship_items_update_manager
  ON public.fund_sponsorship_items
  FOR UPDATE TO authenticated
  USING (public.is_fund_owner(fund_id) OR public.is_fund_admin(fund_id))
  WITH CHECK (public.is_fund_owner(fund_id) OR public.is_fund_admin(fund_id));

CREATE POLICY sponsorship_item_allocations_select_member
  ON public.sponsorship_item_allocations
  FOR SELECT TO authenticated
  USING (public.is_fund_owner(fund_id) OR public.is_fund_member(fund_id));

CREATE POLICY sponsorship_item_allocations_insert_manager
  ON public.sponsorship_item_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_fund_owner(fund_id) OR public.is_fund_admin(fund_id))
  );

CREATE POLICY rich_auntie_awards_select_related
  ON public.rich_auntie_awards
  FOR SELECT TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR public.is_fund_owner(fund_id)
    OR public.is_fund_member(fund_id)
  );

CREATE POLICY rich_auntie_awards_insert_manager
  ON public.rich_auntie_awards
  FOR INSERT TO authenticated
  WITH CHECK (
    awarded_by = auth.uid()
    AND recipient_user_id <> auth.uid()
    AND (public.is_fund_owner(fund_id) OR public.is_fund_admin(fund_id))
    AND EXISTS (
      SELECT 1
      FROM public.fund_members member
      WHERE member.fund_id = rich_auntie_awards.fund_id
        AND member.user_id = rich_auntie_awards.recipient_user_id
        AND member.status = 'joined'::public.member_status
    )
  );

REVOKE ALL ON TABLE public.fund_sponsorship_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.sponsorship_item_allocations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.rich_auntie_awards FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.fund_sponsorship_items TO authenticated;
GRANT INSERT (
  fund_id, title, description, category, target_amount, created_by
) ON TABLE public.fund_sponsorship_items TO authenticated;
GRANT UPDATE (
  title, description, category, target_amount, status,
  linked_expense_id, fulfilled_at, updated_at
) ON TABLE public.fund_sponsorship_items TO authenticated;
GRANT SELECT ON TABLE public.sponsorship_item_allocations TO authenticated;
GRANT INSERT (
  fund_id, sponsorship_item_id, contribution_id, amount, created_by
) ON TABLE public.sponsorship_item_allocations TO authenticated;
GRANT SELECT ON TABLE public.rich_auntie_awards TO authenticated;
GRANT INSERT (
  fund_id, recipient_user_id, sponsorship_item_id, reason_code,
  reason_label, awarded_by, notify_member
) ON TABLE public.rich_auntie_awards TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_sponsorship_item_goal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fund_goal numeric(15,2);
  allocated_goal numeric(15,2);
  item_funded numeric(15,2);
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT goal_amount INTO fund_goal
  FROM public.funds
  WHERE id = NEW.fund_id
    AND deleted_at IS NULL
    AND status = 'active'
  FOR UPDATE;

  IF fund_goal IS NULL THEN
    RAISE EXCEPTION 'The fund is unavailable or no longer active';
  END IF;

  SELECT COALESCE(sum(target_amount), 0) INTO allocated_goal
  FROM public.fund_sponsorship_items
  WHERE fund_id = NEW.fund_id
    AND status <> 'cancelled'
    AND id IS DISTINCT FROM NEW.id;

  IF allocated_goal + NEW.target_amount > fund_goal THEN
    RAISE EXCEPTION
      'Sponsorship items cannot exceed the fund goal. Increase the fund goal first.';
  END IF;

  IF NEW.status = 'funded' THEN
    SELECT COALESCE(sum(amount), 0) INTO item_funded
    FROM public.sponsorship_item_allocations
    WHERE sponsorship_item_id = NEW.id;

    IF item_funded < NEW.target_amount THEN
      RAISE EXCEPTION 'The full item amount must be received before it is marked funded';
    END IF;
  END IF;

  IF NEW.status = 'fulfilled' AND (
    NEW.linked_expense_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.expenses expense
      WHERE expense.id = NEW.linked_expense_id
        AND expense.fund_id = NEW.fund_id
        AND expense.deleted_at IS NULL
        AND (
          OLD.status = 'funded'
          OR (
            OLD.status = 'claimed'
            AND expense.is_sponsored = true
            AND expense.sponsored_by_user_id = NEW.claimed_by_user_id
            AND expense.amount >= NEW.target_amount
          )
        )
    )
  ) THEN
    RAISE EXCEPTION
      'A fulfilled item must link to its fund expense or the sponsor''s direct purchase';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_sponsorship_item_goal() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_sponsorship_item_goal_before_write
  BEFORE INSERT OR UPDATE OF target_amount, status
  ON public.fund_sponsorship_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_sponsorship_item_goal();

CREATE OR REPLACE FUNCTION public.validate_fund_goal_for_sponsorship_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_goal numeric(15,2);
BEGIN
  SELECT COALESCE(sum(target_amount), 0) INTO assigned_goal
  FROM public.fund_sponsorship_items
  WHERE fund_id = NEW.id
    AND status <> 'cancelled';

  IF COALESCE(NEW.goal_amount, 0) < assigned_goal THEN
    RAISE EXCEPTION
      'The fund goal cannot be lower than its active sponsorship items';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_fund_goal_for_sponsorship_items()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_fund_goal_for_sponsorship_items_before_update
  BEFORE UPDATE OF goal_amount ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.validate_fund_goal_for_sponsorship_items();

CREATE OR REPLACE FUNCTION public.claim_sponsorship_item(p_item_id uuid)
RETURNS public.fund_sponsorship_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_item public.fund_sponsorship_items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.fund_sponsorship_items item
  SET
    status = 'claimed',
    claimed_by_user_id = auth.uid(),
    claimed_at = now(),
    updated_at = now()
  WHERE item.id = p_item_id
    AND item.status = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.fund_members member
      JOIN public.funds fund ON fund.id = member.fund_id
      WHERE member.fund_id = item.fund_id
        AND member.user_id = auth.uid()
        AND member.status = 'joined'::public.member_status
        AND fund.status = 'active'
        AND fund.deleted_at IS NULL
    )
  RETURNING item.* INTO claimed_item;

  IF claimed_item.id IS NULL THEN
    RAISE EXCEPTION 'This item is no longer available to claim';
  END IF;

  RETURN claimed_item;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_sponsorship_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_sponsorship_item(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_sponsorship_item(p_item_id uuid)
RETURNS public.fund_sponsorship_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_item public.fund_sponsorship_items;
BEGIN
  UPDATE public.fund_sponsorship_items item
  SET
    status = 'open',
    claimed_by_user_id = NULL,
    claimed_at = NULL,
    updated_at = now()
  WHERE item.id = p_item_id
    AND item.status = 'claimed'
    AND NOT EXISTS (
      SELECT 1
      FROM public.sponsorship_item_allocations allocation
      WHERE allocation.sponsorship_item_id = item.id
    )
    AND (
      item.claimed_by_user_id = auth.uid()
      OR public.is_fund_owner(item.fund_id)
      OR public.is_fund_admin(item.fund_id)
    )
  RETURNING item.* INTO released_item;

  IF released_item.id IS NULL THEN
    RAISE EXCEPTION 'This claim cannot be released after money has been allocated';
  END IF;

  RETURN released_item;
END;
$$;

REVOKE ALL ON FUNCTION public.release_sponsorship_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_sponsorship_item(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_sponsorship_item_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.fund_sponsorship_items%ROWTYPE;
  payment public.contributions%ROWTYPE;
  already_allocated numeric(15,2);
BEGIN
  SELECT * INTO item
  FROM public.fund_sponsorship_items
  WHERE id = NEW.sponsorship_item_id
  FOR UPDATE;

  SELECT * INTO payment
  FROM public.contributions
  WHERE id = NEW.contribution_id
  FOR UPDATE;

  IF item.id IS NULL OR payment.id IS NULL THEN
    RAISE EXCEPTION 'Sponsorship item or contribution was not found';
  END IF;
  IF item.fund_id <> NEW.fund_id OR payment.fund_id <> NEW.fund_id THEN
    RAISE EXCEPTION 'The sponsorship item and contribution must belong to the same fund';
  END IF;
  IF item.status NOT IN ('claimed', 'funded') OR item.claimed_by_user_id IS NULL THEN
    RAISE EXCEPTION 'The sponsorship item must be claimed before money is allocated';
  END IF;
  IF payment.status <> 'confirmed'::public.contribution_status
     OR COALESCE(payment.is_refunded, false) THEN
    RAISE EXCEPTION 'Only confirmed, non-refunded contributions can be allocated';
  END IF;
  IF payment.user_id IS DISTINCT FROM item.claimed_by_user_id THEN
    RAISE EXCEPTION 'The contribution must belong to the member who claimed this item';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO already_allocated
  FROM public.sponsorship_item_allocations
  WHERE sponsorship_item_id = NEW.sponsorship_item_id
    AND id IS DISTINCT FROM NEW.id;

  IF already_allocated + NEW.amount > item.target_amount THEN
    RAISE EXCEPTION 'Allocation exceeds the sponsorship item amount';
  END IF;
  IF NEW.amount > payment.amount THEN
    RAISE EXCEPTION 'Allocation exceeds the received contribution';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_sponsorship_item_allocation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_sponsorship_item_allocation_before_write
  BEFORE INSERT OR UPDATE ON public.sponsorship_item_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_sponsorship_item_allocation();

CREATE OR REPLACE FUNCTION public.refresh_sponsorship_item_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_id uuid := COALESCE(NEW.sponsorship_item_id, OLD.sponsorship_item_id);
  allocated numeric(15,2);
  target numeric(15,2);
BEGIN
  SELECT
    item.target_amount,
    COALESCE(sum(allocation.amount), 0)
  INTO target, allocated
  FROM public.fund_sponsorship_items item
  LEFT JOIN public.sponsorship_item_allocations allocation
    ON allocation.sponsorship_item_id = item.id
  WHERE item.id = item_id
  GROUP BY item.id;

  UPDATE public.fund_sponsorship_items
  SET
    status = CASE WHEN allocated >= target THEN 'funded' ELSE 'claimed' END,
    funded_at = CASE WHEN allocated >= target THEN COALESCE(funded_at, now()) ELSE NULL END,
    updated_at = now()
  WHERE id = item_id
    AND status <> 'fulfilled';

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_sponsorship_item_status() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER refresh_sponsorship_item_status_after_write
  AFTER INSERT OR UPDATE OR DELETE ON public.sponsorship_item_allocations
  FOR EACH ROW EXECUTE FUNCTION public.refresh_sponsorship_item_status();

CREATE OR REPLACE FUNCTION public.remove_invalid_sponsorship_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'confirmed'::public.contribution_status
     OR COALESCE(NEW.is_refunded, false) THEN
    DELETE FROM public.sponsorship_item_allocations
    WHERE contribution_id = NEW.id;
  ELSIF EXISTS (
    SELECT 1
    FROM public.sponsorship_item_allocations allocation
    WHERE allocation.contribution_id = NEW.id
      AND allocation.amount > NEW.amount
  ) THEN
    RAISE EXCEPTION
      'The contribution cannot be reduced below its sponsorship allocation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_invalid_sponsorship_allocation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER remove_invalid_sponsorship_allocation_after_update
  AFTER UPDATE OF amount, status, is_refunded ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.remove_invalid_sponsorship_allocation();

CREATE VIEW public.fund_sponsorship_item_progress
WITH (security_invoker = true)
AS
SELECT
  item.id,
  item.fund_id,
  item.title,
  item.description,
  item.category,
  item.target_amount,
  COALESCE(sum(allocation.amount), 0)::numeric(15,2) AS allocated_amount,
  GREATEST(
    item.target_amount - COALESCE(sum(allocation.amount), 0),
    0
  )::numeric(15,2) AS outstanding_amount,
  item.status,
  item.created_by,
  item.claimed_by_user_id,
  item.claimed_at,
  item.funded_at,
  item.fulfilled_at,
  item.linked_expense_id,
  item.created_at,
  item.updated_at
FROM public.fund_sponsorship_items item
LEFT JOIN public.sponsorship_item_allocations allocation
  ON allocation.sponsorship_item_id = item.id
GROUP BY item.id;

REVOKE ALL ON TABLE public.fund_sponsorship_item_progress FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.fund_sponsorship_item_progress TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_rich_auntie_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sponsorship_item_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.fund_sponsorship_items item
       WHERE item.id = NEW.sponsorship_item_id
         AND item.fund_id = NEW.fund_id
         AND item.claimed_by_user_id = NEW.recipient_user_id
         AND item.status IN ('funded', 'fulfilled')
     ) THEN
    RAISE EXCEPTION
      'The linked item must be funded by the member receiving this award';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_rich_auntie_award() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_rich_auntie_award_before_insert
  BEFORE INSERT ON public.rich_auntie_awards
  FOR EACH ROW EXECUTE FUNCTION public.validate_rich_auntie_award();

CREATE OR REPLACE FUNCTION public.notify_rich_auntie_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fund_title text;
  organiser_name text;
BEGIN
  IF NOT NEW.notify_member THEN
    RETURN NEW;
  END IF;

  SELECT title INTO fund_title FROM public.funds WHERE id = NEW.fund_id;
  SELECT name INTO organiser_name FROM public.users WHERE id = NEW.awarded_by;

  INSERT INTO public.notifications (
    user_id,
    fund_id,
    type,
    title,
    body,
    data
  ) VALUES (
    NEW.recipient_user_id,
    NEW.fund_id,
    'rich_auntie_tagged'::public.notification_type,
    'You''re a Rich Auntie!',
    COALESCE(organiser_name, 'An organiser') || ' recognised you for ' || NEW.reason_label || '.',
    jsonb_build_object(
      'kind', 'rich_auntie_award',
      'awardId', NEW.id,
      'fundId', NEW.fund_id,
      'fundTitle', fund_title,
      'reason', NEW.reason_label
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_rich_auntie_award() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_rich_auntie_award_after_insert
  AFTER INSERT ON public.rich_auntie_awards
  FOR EACH ROW EXECUTE FUNCTION public.notify_rich_auntie_award();
