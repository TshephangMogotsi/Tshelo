-- Close client-side privilege escalation and data-exposure paths discovered in
-- the July 2026 security review. This migration is intentionally additive for
-- data: existing memberships and financial rows are preserved.

-- ---------------------------------------------------------------------------
-- Fund discovery and membership
-- ---------------------------------------------------------------------------

-- This policy name claimed to scope discovery by share code, but its predicate
-- exposed every non-deleted fund to every authenticated user.
DROP POLICY IF EXISTS "Authenticated users can discover funds by share code" ON public.funds;

-- Discovery remains available to signed-in clients only when they present the
-- exact bearer code. Public social previews go through the fund-preview Edge
-- Function, whose service-role call is granted explicitly.
REVOKE ALL ON FUNCTION public.find_fund_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_fund_by_code(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_fund_privacy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fund_privacy(uuid) TO authenticated, service_role;

-- Invite codes are bearer credentials. Generate them exclusively on the
-- server and use substantially more entropy for newly created funds.
CREATE OR REPLACE FUNCTION public.generate_fund_code()
RETURNS character varying
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate character varying;
BEGIN
  LOOP
    candidate := 'FND-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.funds WHERE fund_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_fund_share_code()
RETURNS character varying
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate character varying;
BEGIN
  LOOP
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.funds WHERE share_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_generate_fund_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Never accept a caller-supplied invite credential.
  NEW.fund_code := public.generate_fund_code();
  NEW.share_code := public.generate_fund_share_code();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS fund_members_insert_manager ON public.fund_members;
DROP POLICY IF EXISTS fund_members_update_manager ON public.fund_members;
DROP POLICY IF EXISTS fund_members_update_related ON public.fund_members;

-- Direct inserts are limited to owner bootstrap rows and manager-created
-- pending invitations. Joining by code is handled only by join_fund_by_code().
CREATE POLICY fund_members_insert_manager ON public.fund_members
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_fund_owner(fund_id)
      AND user_id = auth.uid()
      AND invited_by = auth.uid()
      AND role = 'owner'::public.member_role
      AND status = 'joined'::public.member_status
    )
    OR
    (
      invited_by = auth.uid()
      AND (public.is_fund_owner(fund_id) OR public.is_fund_admin(fund_id))
      AND role = 'member'::public.member_role
      AND status = 'pending'::public.member_status
    )
  );

-- Managers may approve/remove ordinary members. A trigger below protects
-- identity fields, owner/admin rows, and role changes from administrators.
CREATE POLICY fund_members_update_manager ON public.fund_members
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_fund_owner(fund_id) OR public.is_fund_admin(fund_id))
  WITH CHECK (public.is_fund_owner(fund_id) OR public.is_fund_admin(fund_id));

CREATE OR REPLACE FUNCTION public.enforce_fund_member_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  caller_is_owner boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  caller_is_owner := public.is_fund_owner(OLD.fund_id);

  IF NEW.fund_id IS DISTINCT FROM OLD.fund_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
    RAISE EXCEPTION 'Membership identity fields cannot be changed';
  END IF;

  IF OLD.role = 'owner'::public.member_role
     OR NEW.role = 'owner'::public.member_role THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Fund ownership must be transferred through the ownership workflow';
    END IF;
  END IF;

  -- Administrators can manage ordinary members, but cannot mutate other
  -- privileged rows or grant/revoke administrative access.
  IF NOT caller_is_owner AND OLD.role IN ('owner'::public.member_role, 'admin'::public.member_role) THEN
    RAISE EXCEPTION 'Only the fund owner can manage privileged members';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT caller_is_owner THEN
      RAISE EXCEPTION 'Only the fund owner can change member roles';
    END IF;
    IF NEW.role = 'admin'::public.member_role THEN
      NEW.promoted_by := auth.uid();
      NEW.promoted_to_admin_at := now();
    ELSE
      NEW.promoted_by := NULL;
      NEW.promoted_to_admin_at := NULL;
    END IF;
  ELSIF NEW.promoted_by IS DISTINCT FROM OLD.promoted_by
        OR NEW.promoted_to_admin_at IS DISTINCT FROM OLD.promoted_to_admin_at THEN
    RAISE EXCEPTION 'Promotion metadata is server-controlled';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_fund_member_update ON public.fund_members;
CREATE TRIGGER enforce_fund_member_update
  BEFORE UPDATE ON public.fund_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_fund_member_update();

-- The only client-facing way to join a fund. Privacy, status, role, and the
-- current user are selected server-side rather than accepted from the app.
CREATE OR REPLACE FUNCTION public.join_fund_by_code(p_code text)
RETURNS TABLE(fund_id uuid, membership_status public.member_status, is_private boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target public.funds%ROWTYPE;
  existing public.fund_members%ROWTYPE;
  next_status public.member_status;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_code IS NULL OR length(trim(p_code)) < 8 THEN
    RAISE EXCEPTION 'Invalid fund code';
  END IF;

  SELECT * INTO target
  FROM public.funds
  WHERE fund_code = upper(trim(p_code))
    AND deleted_at IS NULL
  LIMIT 1;

  IF target.id IS NULL OR target.status <> 'active' THEN
    RAISE EXCEPTION 'Fund is unavailable';
  END IF;
  IF target.owner_id = caller_id THEN
    RAISE EXCEPTION 'You already own this fund';
  END IF;

  next_status := CASE
    WHEN target.is_private THEN 'pending'::public.member_status
    ELSE 'joined'::public.member_status
  END;

  SELECT * INTO existing
  FROM public.fund_members fm
  WHERE fm.fund_id = target.id AND fm.user_id = caller_id
  FOR UPDATE;

  IF existing.id IS NOT NULL THEN
    IF existing.status IN ('pending'::public.member_status, 'joined'::public.member_status) THEN
      RAISE EXCEPTION 'You already have a membership for this fund';
    END IF;
    IF existing.role <> 'member'::public.member_role THEN
      RAISE EXCEPTION 'A fund owner must restore this membership';
    END IF;

    UPDATE public.fund_members
    SET status = next_status,
        invited_at = now(),
        joined_at = CASE WHEN next_status = 'joined'::public.member_status THEN now() ELSE NULL END
    WHERE id = existing.id;
  ELSE
    INSERT INTO public.fund_members (
      fund_id, user_id, invited_by, role, status, joined_at
    ) VALUES (
      target.id,
      caller_id,
      caller_id,
      'member'::public.member_role,
      next_status,
      CASE WHEN next_status = 'joined'::public.member_status THEN now() ELSE NULL END
    );
  END IF;

  RETURN QUERY SELECT target.id, next_status, target.is_private;
END;
$$;

REVOKE ALL ON FUNCTION public.join_fund_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_fund_by_code(text) TO authenticated;

-- Pending join requests must not reveal the names and phone numbers of current
-- members. Owners and joined members retain access.
CREATE OR REPLACE FUNCTION public.get_fund_member_profiles(p_fund_id uuid)
RETURNS TABLE(member_row_id uuid, user_id uuid, name text, phone text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fm.id, u.id, u.name, u.phone
  FROM public.fund_members fm
  JOIN public.users u ON u.id = fm.user_id
  WHERE fm.fund_id = p_fund_id
    AND (
      public.is_fund_owner(p_fund_id)
      OR EXISTS (
        SELECT 1 FROM public.fund_members caller
        WHERE caller.fund_id = p_fund_id
          AND caller.user_id = auth.uid()
          AND caller.status = 'joined'::public.member_status
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_fund_member_profiles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fund_member_profiles(uuid) TO authenticated;

-- Trigger-only notification helpers must never be exposed as public RPCs.
REVOKE ALL ON FUNCTION public.create_notification(uuid, uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fund_manager_ids(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fund_member_user_ids(uuid)
  FROM PUBLIC, anon, authenticated;

-- The baseline contained a compromised static webhook credential. Disable
-- that trigger before rotating the secret and recreating the webhook through
-- the Supabase dashboard, where the header is not committed to source control.
DROP TRIGGER IF EXISTS "send-push" ON public.notifications;

-- ---------------------------------------------------------------------------
-- Protect server-owned profile and notification fields
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

REVOKE UPDATE ON TABLE public.users FROM anon, authenticated;
GRANT UPDATE (
  name, email, avatar_url, country_code, preferred_currency, language,
  mobile_money_provider, mobile_money_number, mobile_money_name,
  bank_name, bank_account_number, bank_account_name, bank_branch_code,
  notifications_enabled, profile_completed, onboarding_completed,
  terms_accepted_at, terms_version, privacy_accepted_at, privacy_version,
  marketing_consent, marketing_consent_at, marketing_email_enabled,
  marketing_sms_enabled, marketing_push_enabled,
  data_processing_consent, data_processing_consent_at
) ON public.users TO authenticated;

-- Users may mark their own notifications read, but may not rewrite messages.
REVOKE UPDATE ON TABLE public.notifications FROM anon, authenticated;
GRANT UPDATE (is_read, read_at, opened_at, clicked_at, response_action)
  ON public.notifications TO authenticated;

-- Owners can edit fund content and lifecycle state, but invite credentials,
-- ownership history, referral attribution, and warning flags are server-owned.
REVOKE INSERT, UPDATE ON TABLE public.funds FROM anon, authenticated;
GRANT INSERT (
  owner_id, title, description, fund_type, type_specific_data, currency_code,
  goal_amount, event_date, event_time, event_location, event_location_lat,
  event_location_lng, attendees, contribution_deadline, auto_close_days,
  cover_photo_url, show_leaderboard, reminder_frequency, status,
  linked_event_id, fund_emoji, is_private
) ON public.funds TO authenticated;
GRANT UPDATE (
  title, description, type_specific_data, goal_amount, event_date, event_time,
  event_location, event_location_lat, event_location_lng, attendees,
  contribution_deadline, auto_close_days, cover_photo_url, show_leaderboard,
  reminder_frequency, status, closed_at, deleted_at, linked_event_id,
  fund_emoji, is_private, updated_at
) ON public.funds TO authenticated;

-- ---------------------------------------------------------------------------
-- Financial integrity
-- ---------------------------------------------------------------------------

-- NOT VALID preserves any historical anomalies while enforcing these checks
-- for all new and changed rows. Existing data can be cleaned and validated in
-- a follow-up migration.
ALTER TABLE public.funds
  ADD CONSTRAINT funds_goal_nonnegative CHECK (goal_amount IS NULL OR goal_amount >= 0) NOT VALID;
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_amount_positive CHECK (amount > 0) NOT VALID;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0) NOT VALID,
  ADD CONSTRAINT expenses_quantity_positive CHECK (quantity IS NULL OR quantity > 0) NOT VALID,
  ADD CONSTRAINT expenses_unit_price_positive CHECK (unit_price IS NULL OR unit_price > 0) NOT VALID;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0) NOT VALID,
  ADD CONSTRAINT payments_tokens_positive CHECK (tokens_purchased > 0) NOT VALID;
ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_amount_nonzero CHECK (amount <> 0) NOT VALID,
  ADD CONSTRAINT token_transactions_balance_nonnegative CHECK (balance_after >= 0) NOT VALID;

-- Payment and ledger records are created only after server-side provider
-- verification. The current app has no legitimate direct-write flow.
DROP POLICY IF EXISTS payments_insert ON public.payments;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.token_transactions FROM anon, authenticated;

-- Limit mutable financial columns to the fields supported by organiser edit
-- flows. Ownership and system-generated reconciliation fields are excluded.
REVOKE UPDATE ON TABLE public.contributions FROM anon, authenticated;
GRANT UPDATE (
  contributor_name, amount, payment_method, reference_number, status,
  is_refunded, refunded_at, confirmed_by, confirmed_at, notes, updated_at
) ON public.contributions TO authenticated;
REVOKE UPDATE ON TABLE public.expenses FROM anon, authenticated;
GRANT UPDATE (
  description, category, amount, item_name, quantity, unit_price, vendor_name,
  deleted_at, updated_at
) ON public.expenses TO authenticated;

DROP POLICY IF EXISTS contributions_insert ON public.contributions;
CREATE POLICY contributions_insert ON public.contributions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    tagged_by = auth.uid()
    AND (confirmed_by IS NULL OR confirmed_by = auth.uid())
    AND (refund_confirmed_by IS NULL OR refund_confirmed_by = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.funds f
      WHERE f.id = contributions.fund_id
        AND f.deleted_at IS NULL
        AND f.status = 'active'
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

DROP POLICY IF EXISTS expenses_insert ON public.expenses;
CREATE POLICY expenses_insert ON public.expenses
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.funds f
      WHERE f.id = expenses.fund_id
        AND f.deleted_at IS NULL
        AND f.status = 'active'
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

DROP POLICY IF EXISTS expenses_update ON public.expenses;
CREATE POLICY expenses_update ON public.expenses
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funds f
      WHERE f.id = expenses.fund_id
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.funds f
      WHERE f.id = expenses.fund_id
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

CREATE OR REPLACE FUNCTION public.enforce_financial_row_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'contributions' THEN
    IF NEW.fund_id IS DISTINCT FROM OLD.fund_id
       OR NEW.tagged_by IS DISTINCT FROM OLD.tagged_by
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
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

DROP TRIGGER IF EXISTS enforce_contribution_identity ON public.contributions;
CREATE TRIGGER enforce_contribution_identity
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_row_identity();

DROP TRIGGER IF EXISTS enforce_expense_identity ON public.expenses;
CREATE TRIGGER enforce_expense_identity
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_row_identity();

-- ---------------------------------------------------------------------------
-- Receipt parsing rate limit and private object storage
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.receipt_parse_usage (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.receipt_parse_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS receipt_parse_usage_user_created_idx
  ON public.receipt_parse_usage (user_id, created_at DESC);
REVOKE ALL ON TABLE public.receipt_parse_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.begin_receipt_parse(p_fund_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  hourly_count integer;
  daily_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RETURN false;
  END IF;
  IF NOT (public.is_fund_owner(p_fund_id) OR public.is_fund_admin(p_fund_id)) THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  SELECT count(*) FILTER (WHERE created_at >= now() - interval '1 hour'),
         count(*) FILTER (WHERE created_at >= now() - interval '1 day')
  INTO hourly_count, daily_count
  FROM public.receipt_parse_usage
  WHERE user_id = caller_id
    AND created_at >= now() - interval '1 day';

  IF hourly_count >= 10 OR daily_count >= 50 THEN
    RETURN false;
  END IF;

  INSERT INTO public.receipt_parse_usage (user_id, fund_id)
  VALUES (caller_id, p_fund_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_receipt_parse(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_receipt_parse(uuid) TO authenticated;

-- Keep receipt documents private. The object key format is
-- <fund UUID>/<uploading user UUID>/<random filename>.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Existing rows stored the former public URL. Preserve the object reference by
-- converting those values to the private bucket path used by new uploads.
UPDATE public.expenses
SET receipt_url = regexp_replace(
  receipt_url,
  '^https?://[^/]+/storage/v1/object/public/receipts/',
  ''
)
WHERE receipt_url ~ '^https?://[^/]+/storage/v1/object/public/receipts/';

DROP POLICY IF EXISTS receipts_insert_manager ON storage.objects;
DROP POLICY IF EXISTS receipts_select_member ON storage.objects;
DROP POLICY IF EXISTS receipts_delete_manager ON storage.objects;

CREATE POLICY receipts_insert_manager ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND (
      public.is_fund_owner(((storage.foldername(name))[1])::uuid)
      OR public.is_fund_admin(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY receipts_select_member ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      public.is_fund_owner(((storage.foldername(name))[1])::uuid)
      OR public.is_fund_member(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY receipts_delete_manager ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.is_fund_owner(((storage.foldername(name))[1])::uuid)
    )
  );
