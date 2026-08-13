-- Preserve the amount a member promised separately from the amount ultimately
-- received. A pledge begins as a contribution row with status = 'pledged'; an
-- organiser can later confirm the same row with the actual received amount
-- while pledged_amount remains unchanged for variance reporting.

ALTER TABLE public.contributions
  ADD COLUMN pledged_amount numeric(15,2);

UPDATE public.contributions
SET pledged_amount = amount
WHERE status = 'pledged'::public.contribution_status
  AND pledged_amount IS NULL;

ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_pledged_amount_positive
    CHECK (pledged_amount IS NULL OR pledged_amount > 0) NOT VALID,
  ADD CONSTRAINT contributions_pledge_state_valid
    CHECK (
      status <> 'pledged'::public.contribution_status
      OR (
        pledged_amount IS NOT NULL
        AND pledged_amount = amount
        AND confirmed_by IS NULL
        AND confirmed_at IS NULL
      )
    ) NOT VALID,
  ADD CONSTRAINT contributions_confirmation_state_valid
    CHECK (
      status <> 'confirmed'::public.contribution_status
      OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
    ) NOT VALID;

COMMENT ON COLUMN public.contributions.pledged_amount IS
  'Original amount promised by the contributor; retained when actual received amount differs.';

-- Organisers may correct pledge amounts. Identity and system-owned columns
-- remain protected by enforce_financial_row_identity().
REVOKE UPDATE ON TABLE public.contributions FROM anon, authenticated;
GRANT UPDATE (
  contributor_name, amount, pledged_amount, payment_method, reference_number,
  status, is_refunded, refunded_at, confirmed_by, confirmed_at, notes, updated_at
) ON public.contributions TO authenticated;

DROP POLICY IF EXISTS contributions_insert ON public.contributions;
CREATE POLICY contributions_insert ON public.contributions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    tagged_by = auth.uid()
    AND status IN (
      'pledged'::public.contribution_status,
      'pending'::public.contribution_status,
      'confirmed'::public.contribution_status
    )
    AND COALESCE(is_refunded, false) = false
    AND refunded_at IS NULL
    AND refund_confirmed_by IS NULL
    AND refund_confirmed_at IS NULL
    AND (
      (
        status = 'confirmed'::public.contribution_status
        AND confirmed_by = auth.uid()
        AND confirmed_at IS NOT NULL
      )
      OR
      (
        status <> 'confirmed'::public.contribution_status
        AND confirmed_by IS NULL
        AND confirmed_at IS NULL
      )
    )
    AND (
      status <> 'pledged'::public.contribution_status
      OR (pledged_amount = amount AND payment_method IS NULL)
    )
    AND (
      -- Fund owners/admins may record a member contribution or an external
      -- contribution (user_id NULL).
      (
        EXISTS (
          SELECT 1 FROM public.funds f
          WHERE f.id = contributions.fund_id
            AND f.deleted_at IS NULL
            AND f.status = 'active'
            AND (
              f.owner_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.fund_members manager
                WHERE manager.fund_id = f.id
                  AND manager.user_id = auth.uid()
                  AND manager.role IN ('owner'::public.member_role, 'admin'::public.member_role)
                  AND manager.status = 'joined'::public.member_status
              )
            )
        )
        AND (
          user_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.fund_members contributor
            WHERE contributor.fund_id = contributions.fund_id
              AND contributor.user_id = contributions.user_id
              AND contributor.status = 'joined'::public.member_status
          )
        )
      )
      OR
      -- Ordinary joined members may create only their own pledge. They cannot
      -- mark money as received or pledge on another member's behalf.
      (
        user_id = auth.uid()
        AND status = 'pledged'::public.contribution_status
        AND pledged_amount = amount
        AND EXISTS (
          SELECT 1 FROM public.fund_members self_member
          JOIN public.funds f ON f.id = self_member.fund_id
          WHERE self_member.fund_id = contributions.fund_id
            AND self_member.user_id = auth.uid()
            AND self_member.status = 'joined'::public.member_status
            AND f.deleted_at IS NULL
            AND f.status = 'active'
        )
      )
    )
  );

-- Include pledge changes in the immutable activity trail.
CREATE OR REPLACE FUNCTION public.log_contribution_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_old jsonb := '{}'::jsonb;
  changed_new jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (NEW.fund_id, auth.uid(), 'created', 'contribution', NEW.id,
      jsonb_build_object(
        'contributor_name', NEW.contributor_name,
        'amount', NEW.amount,
        'pledged_amount', NEW.pledged_amount,
        'currency_code', NEW.currency_code,
        'payment_method', NEW.payment_method,
        'reference_number', NEW.reference_number,
        'status', NEW.status
      ));
    RETURN NEW;
  END IF;

  IF NEW.contributor_name IS DISTINCT FROM OLD.contributor_name THEN
    changed_old := changed_old || jsonb_build_object('contributor_name', OLD.contributor_name);
    changed_new := changed_new || jsonb_build_object('contributor_name', NEW.contributor_name);
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    changed_old := changed_old || jsonb_build_object('amount', OLD.amount);
    changed_new := changed_new || jsonb_build_object('amount', NEW.amount);
  END IF;
  IF NEW.pledged_amount IS DISTINCT FROM OLD.pledged_amount THEN
    changed_old := changed_old || jsonb_build_object('pledged_amount', OLD.pledged_amount);
    changed_new := changed_new || jsonb_build_object('pledged_amount', NEW.pledged_amount);
  END IF;
  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    changed_old := changed_old || jsonb_build_object('payment_method', OLD.payment_method);
    changed_new := changed_new || jsonb_build_object('payment_method', NEW.payment_method);
  END IF;
  IF NEW.reference_number IS DISTINCT FROM OLD.reference_number THEN
    changed_old := changed_old || jsonb_build_object('reference_number', OLD.reference_number);
    changed_new := changed_new || jsonb_build_object('reference_number', NEW.reference_number);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    changed_old := changed_old || jsonb_build_object('status', OLD.status);
    changed_new := changed_new || jsonb_build_object('status', NEW.status);
  END IF;
  IF NEW.is_refunded IS DISTINCT FROM OLD.is_refunded THEN
    changed_old := changed_old || jsonb_build_object('is_refunded', OLD.is_refunded);
    changed_new := changed_new || jsonb_build_object('is_refunded', NEW.is_refunded);
  END IF;
  IF changed_old = '{}'::jsonb THEN RETURN NEW; END IF;

  INSERT INTO audit_log (fund_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (NEW.fund_id, auth.uid(), 'updated', 'contribution', NEW.id, changed_old, changed_new);
  RETURN NEW;
END $$;
