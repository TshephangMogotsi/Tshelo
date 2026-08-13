-- Phase 2 of granular fund administration. Operational writes now require the
-- capability that matches the action instead of the broad admin role. Fund
-- owners retain their implicit override through has_fund_permission().

-- A fund permission can also govern the corresponding part of its linked
-- Event + Fund. Standalone-event creators and organisers retain their existing
-- event-side authority.
CREATE OR REPLACE FUNCTION public.has_linked_event_fund_permission(
  p_event_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events AS target_event
    WHERE target_event.id = p_event_id
      AND target_event.deleted_at IS NULL
      AND target_event.linked_fund_id IS NOT NULL
      AND public.has_fund_permission(
        target_event.linked_fund_id,
        p_permission_key
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_linked_event_fund_permission(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_linked_event_fund_permission(uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Contributions
-- ---------------------------------------------------------------------------

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
      (
        public.has_fund_permission(fund_id, 'record_contributions')
        AND EXISTS (
          SELECT 1
          FROM public.funds AS target_fund
          WHERE target_fund.id = contributions.fund_id
            AND target_fund.deleted_at IS NULL
            AND target_fund.status = 'active'
        )
        AND (
          user_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.fund_members AS contributor
            WHERE contributor.fund_id = contributions.fund_id
              AND contributor.user_id = contributions.user_id
              AND contributor.status = 'joined'::public.member_status
          )
        )
      )
      OR
      (
        user_id = auth.uid()
        AND status = 'pledged'::public.contribution_status
        AND pledged_amount = amount
        AND EXISTS (
          SELECT 1
          FROM public.fund_members AS self_member
          JOIN public.funds AS target_fund
            ON target_fund.id = self_member.fund_id
          WHERE self_member.fund_id = contributions.fund_id
            AND self_member.user_id = auth.uid()
            AND self_member.status = 'joined'::public.member_status
            AND target_fund.deleted_at IS NULL
            AND target_fund.status = 'active'
        )
      )
    )
  );

DROP POLICY IF EXISTS contributions_update_manager ON public.contributions;
CREATE POLICY contributions_update_manager ON public.contributions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.has_fund_permission(fund_id, 'record_contributions')
    OR public.has_fund_permission(fund_id, 'edit_contributions')
  )
  WITH CHECK (
    public.has_fund_permission(fund_id, 'record_contributions')
    OR public.has_fund_permission(fund_id, 'edit_contributions')
  );

-- UPDATE RLS decides whether the caller may reach a contribution. This trigger
-- separates the two independent contribution capabilities at field level.
CREATE OR REPLACE FUNCTION public.enforce_contribution_update_permission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  caller_is_owner boolean;
  can_record boolean;
  can_edit boolean;
  is_recording_received_money boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  caller_is_owner := public.is_fund_owner(OLD.fund_id);
  IF caller_is_owner THEN
    RETURN NEW;
  END IF;

  can_record := public.has_fund_permission(OLD.fund_id, 'record_contributions');
  can_edit := public.has_fund_permission(OLD.fund_id, 'edit_contributions');

  -- Refunds are an ownership power, never a delegatable admin permission.
  IF NEW.is_refunded IS DISTINCT FROM OLD.is_refunded
     OR NEW.refunded_at IS DISTINCT FROM OLD.refunded_at
     OR (
       NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status = 'refunded'::public.contribution_status
     ) THEN
    RAISE EXCEPTION 'Only the fund owner can record or change a refund';
  END IF;

  is_recording_received_money :=
    NEW.status = 'confirmed'::public.contribution_status
    AND (
      OLD.status <> 'confirmed'::public.contribution_status
      OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
      OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
    );

  IF is_recording_received_money AND NOT can_record THEN
    RAISE EXCEPTION 'Recording received money requires record_contributions permission';
  END IF;

  IF can_edit THEN
    RETURN NEW;
  END IF;

  -- A record-only admin may confirm a pending payment or pledge and capture
  -- its actual amount/payment reference, but cannot generally edit the row.
  IF can_record
     AND is_recording_received_money
     AND NEW.pledged_amount IS NOT DISTINCT FROM OLD.pledged_amount
     AND NEW.is_refunded IS NOT DISTINCT FROM OLD.is_refunded
     AND NEW.refunded_at IS NOT DISTINCT FROM OLD.refunded_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Editing a contribution requires edit_contributions permission';
END;
$$;

DROP TRIGGER IF EXISTS enforce_contribution_update_permission
  ON public.contributions;
CREATE TRIGGER enforce_contribution_update_permission
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contribution_update_permission();

REVOKE ALL ON FUNCTION public.enforce_contribution_update_permission()
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS pledge_allocations_insert_manager
  ON public.pledge_allocations;
CREATE POLICY pledge_allocations_insert_manager
  ON public.pledge_allocations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_fund_permission(fund_id, 'record_contributions')
  );

DROP POLICY IF EXISTS contribution_reminders_insert
  ON public.contribution_reminders;
CREATE POLICY contribution_reminders_insert
  ON public.contribution_reminders
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.has_fund_permission(fund_id, 'manage_members')
  );

-- SMS assignment is SECURITY DEFINER, so its permission must be enforced
-- inside the function rather than relying on contributions RLS.
CREATE OR REPLACE FUNCTION public.record_detected_contribution(
  p_fund_id uuid,
  p_detected jsonb,
  p_notification_id uuid DEFAULT NULL
)
RETURNS TABLE(
  recorded_contribution_id uuid,
  recorded_fund_id uuid,
  already_recorded boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  source_notification public.notifications%ROWTYPE;
  selected_fund public.funds%ROWTYPE;
  source_payload jsonb;
  amount_text text;
  amount_value numeric(15,2);
  detection_key text;
  provider_value public.payment_method;
  contribution_id uuid;
  existing_fund_id uuid;
  was_existing boolean := false;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_notification_id IS NOT NULL THEN
    SELECT notification.* INTO source_notification
    FROM public.notifications AS notification
    WHERE notification.id = p_notification_id
      AND notification.user_id = caller_id
      AND notification.type = 'sms_detected'::public.notification_type
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Detected-payment notification is unavailable';
    END IF;
    source_payload := source_notification.data -> 'detectedSms';
  ELSE
    source_payload := p_detected;
  END IF;

  IF source_payload IS NULL OR jsonb_typeof(source_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid detected payment';
  END IF;

  amount_text := source_payload ->> 'amount';
  IF amount_text IS NULL OR amount_text !~ '^[0-9]+([.][0-9]{1,2})?$' THEN
    RAISE EXCEPTION 'Invalid detected amount';
  END IF;
  amount_value := amount_text::numeric;
  IF amount_value <= 0 OR amount_value > 9999999999999.99 THEN
    RAISE EXCEPTION 'Invalid detected amount';
  END IF;

  detection_key := left(trim(coalesce(
    source_payload ->> 'detectionKey',
    CASE WHEN p_notification_id IS NOT NULL
      THEN 'notification:' || p_notification_id::text
      ELSE concat_ws('|',
        'sms',
        source_payload ->> 'receivedAt',
        source_payload ->> 'provider',
        source_payload ->> 'reference',
        source_payload ->> 'senderPhone',
        amount_text
      )
    END
  )), 300);
  IF detection_key = '' THEN
    RAISE EXCEPTION 'Detected payment identity is missing';
  END IF;

  SELECT contribution.id, contribution.fund_id
  INTO contribution_id, existing_fund_id
  FROM public.contributions AS contribution
  WHERE contribution.tagged_by = caller_id
    AND contribution.source_detection_key = detection_key;

  IF FOUND THEN
    UPDATE public.notifications AS notification
    SET response_action = 'recorded',
        is_read = true,
        read_at = coalesce(notification.read_at, now()),
        fund_id = existing_fund_id,
        data = coalesce(notification.data, '{}'::jsonb) || jsonb_build_object(
          'recordedContributionId', contribution_id,
          'recordedFundId', existing_fund_id
        )
    WHERE notification.user_id = caller_id
      AND (
        notification.id = p_notification_id
        OR notification.data #>> '{detectedSms,detectionKey}' = detection_key
      );

    RETURN QUERY SELECT contribution_id, existing_fund_id, true;
    RETURN;
  END IF;

  SELECT target_fund.* INTO selected_fund
  FROM public.funds AS target_fund
  WHERE target_fund.id = p_fund_id
    AND target_fund.deleted_at IS NULL
    AND target_fund.status = 'active'
    AND public.has_fund_permission(
      target_fund.id,
      'record_contributions'
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recording received money requires record_contributions permission';
  END IF;

  provider_value := CASE
    WHEN source_payload ->> 'provider' IN ('orange_money', 'myzaka', 'smega')
      THEN (source_payload ->> 'provider')::public.payment_method
    ELSE NULL
  END;

  BEGIN
    INSERT INTO public.contributions (
      fund_id,
      contributor_name,
      contributor_phone,
      tagged_by,
      amount,
      currency_code,
      payment_method,
      reference_number,
      detected_via,
      status,
      confirmed_by,
      confirmed_at,
      source_detection_key,
      notes
    ) VALUES (
      selected_fund.id,
      left(coalesce(
        nullif(trim(source_payload ->> 'senderName'), ''),
        nullif(trim(source_payload ->> 'senderPhone'), ''),
        'Unknown (SMS)'
      ), 100),
      left(coalesce(source_payload ->> 'senderPhone', ''), 20),
      caller_id,
      amount_value,
      selected_fund.currency_code,
      provider_value,
      nullif(left(trim(source_payload ->> 'reference'), 100), ''),
      'sms',
      'confirmed'::public.contribution_status,
      caller_id,
      now(),
      detection_key,
      NULL
    )
    RETURNING id INTO contribution_id;
    existing_fund_id := selected_fund.id;
  EXCEPTION WHEN unique_violation THEN
    was_existing := true;
    SELECT contribution.id, contribution.fund_id
    INTO contribution_id, existing_fund_id
    FROM public.contributions AS contribution
    WHERE contribution.tagged_by = caller_id
      AND contribution.source_detection_key = detection_key;

    IF contribution_id IS NULL THEN
      RAISE;
    END IF;
  END;

  UPDATE public.notifications AS notification
  SET response_action = 'recorded',
      is_read = true,
      read_at = coalesce(notification.read_at, now()),
      fund_id = existing_fund_id,
      data = coalesce(notification.data, '{}'::jsonb) || jsonb_build_object(
        'recordedContributionId', contribution_id,
        'recordedFundId', existing_fund_id
      )
  WHERE notification.user_id = caller_id
    AND (
      notification.id = p_notification_id
      OR notification.data #>> '{detectedSms,detectionKey}' = detection_key
    );

  RETURN QUERY SELECT contribution_id, existing_fund_id, was_existing;
END;
$$;

REVOKE ALL ON FUNCTION public.record_detected_contribution(uuid, jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_detected_contribution(uuid, jsonb, uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Expenses and receipts
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS expenses_insert ON public.expenses;
CREATE POLICY expenses_insert ON public.expenses
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND public.has_fund_permission(fund_id, 'record_expenses')
    AND EXISTS (
      SELECT 1
      FROM public.funds AS target_fund
      WHERE target_fund.id = expenses.fund_id
        AND target_fund.deleted_at IS NULL
        AND target_fund.status = 'active'
    )
  );

DROP POLICY IF EXISTS expenses_update ON public.expenses;
CREATE POLICY expenses_update ON public.expenses
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.has_fund_permission(fund_id, 'edit_expenses'))
  WITH CHECK (public.has_fund_permission(fund_id, 'edit_expenses'));

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
  IF NOT public.has_fund_permission(p_fund_id, 'record_expenses') THEN
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

DROP POLICY IF EXISTS receipts_insert_manager ON storage.objects;
CREATE POLICY receipts_insert_manager ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.has_fund_permission(
      ((storage.foldername(name))[1])::uuid,
      'record_expenses'
    )
  );

-- ---------------------------------------------------------------------------
-- Members and fund-level operations
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS fund_members_insert_manager ON public.fund_members;
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
      AND public.has_fund_permission(fund_id, 'manage_members')
      AND role = 'member'::public.member_role
      AND status = 'pending'::public.member_status
    )
  );

DROP POLICY IF EXISTS fund_members_update_manager ON public.fund_members;
CREATE POLICY fund_members_update_manager ON public.fund_members
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.has_fund_permission(fund_id, 'manage_members'))
  WITH CHECK (public.has_fund_permission(fund_id, 'manage_members'));

-- The existing helper is used only for membership notifications. Narrowing it
-- prevents admins without member-management access receiving join-request
-- notifications that they cannot act on.
CREATE OR REPLACE FUNCTION public.fund_manager_ids(p_fund_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_fund.owner_id
  FROM public.funds AS target_fund
  WHERE target_fund.id = p_fund_id
  UNION
  SELECT permission_grant.user_id
  FROM public.fund_admin_permissions AS permission_grant
  JOIN public.fund_members AS membership
    ON membership.fund_id = permission_grant.fund_id
   AND membership.user_id = permission_grant.user_id
  WHERE permission_grant.fund_id = p_fund_id
    AND permission_grant.permission_key = 'manage_members'
    AND membership.role = 'admin'::public.member_role
    AND membership.status = 'joined'::public.member_status;
$$;

REVOKE ALL ON FUNCTION public.fund_manager_ids(uuid)
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS fund_announcements_insert ON public.fund_announcements;
CREATE POLICY fund_announcements_insert ON public.fund_announcements
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    posted_by = auth.uid()
    AND public.has_fund_permission(fund_id, 'manage_members')
  );

DROP POLICY IF EXISTS fund_announcements_update ON public.fund_announcements;
CREATE POLICY fund_announcements_update ON public.fund_announcements
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.has_fund_permission(fund_id, 'manage_members'))
  WITH CHECK (public.has_fund_permission(fund_id, 'manage_members'));

DROP POLICY IF EXISTS fund_exports_insert ON public.fund_exports;
CREATE POLICY fund_exports_insert ON public.fund_exports
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    exported_by = auth.uid()
    AND public.has_fund_permission(fund_id, 'export_reports')
  );

-- Allowance counters/settings and moderation records have no delegated
-- capability. They therefore remain owner-only instead of inheriting admin.
DROP POLICY IF EXISTS fund_allowances_update_manager ON public.fund_allowances;
CREATE POLICY fund_allowances_update_owner ON public.fund_allowances
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_fund_owner(fund_id))
  WITH CHECK (public.is_fund_owner(fund_id));

DROP POLICY IF EXISTS disputes_select ON public.disputes;
CREATE POLICY disputes_select ON public.disputes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    raised_by = auth.uid()
    OR public.is_fund_owner(fund_id)
  );

DROP POLICY IF EXISTS fund_reports_select ON public.fund_reports;
CREATE POLICY fund_reports_select ON public.fund_reports
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid()
    OR public.is_fund_owner(fund_id)
  );

-- ---------------------------------------------------------------------------
-- Sponsorships and recognition
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS fund_sponsorship_items_insert_manager
  ON public.fund_sponsorship_items;
CREATE POLICY fund_sponsorship_items_insert_manager
  ON public.fund_sponsorship_items
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND status = 'open'
    AND claimed_by_user_id IS NULL
    AND public.has_fund_permission(fund_id, 'manage_sponsorships')
  );

DROP POLICY IF EXISTS fund_sponsorship_items_update_manager
  ON public.fund_sponsorship_items;
CREATE POLICY fund_sponsorship_items_update_manager
  ON public.fund_sponsorship_items
  FOR UPDATE TO authenticated
  USING (public.has_fund_permission(fund_id, 'manage_sponsorships'))
  WITH CHECK (public.has_fund_permission(fund_id, 'manage_sponsorships'));

DROP POLICY IF EXISTS sponsorship_item_allocations_insert_manager
  ON public.sponsorship_item_allocations;
CREATE POLICY sponsorship_item_allocations_insert_manager
  ON public.sponsorship_item_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_fund_permission(fund_id, 'manage_sponsorships')
  );

DROP POLICY IF EXISTS rich_auntie_awards_insert_manager
  ON public.rich_auntie_awards;
CREATE POLICY rich_auntie_awards_insert_manager
  ON public.rich_auntie_awards
  FOR INSERT TO authenticated
  WITH CHECK (
    awarded_by = auth.uid()
    AND recipient_user_id <> auth.uid()
    AND public.has_fund_permission(fund_id, 'award_recognition')
    AND EXISTS (
      SELECT 1
      FROM public.fund_members AS recipient
      WHERE recipient.fund_id = rich_auntie_awards.fund_id
        AND recipient.user_id = rich_auntie_awards.recipient_user_id
        AND recipient.status = 'joined'::public.member_status
    )
  );

CREATE OR REPLACE FUNCTION public.release_sponsorship_item(p_item_id uuid)
RETURNS public.fund_sponsorship_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_item public.fund_sponsorship_items;
BEGIN
  UPDATE public.fund_sponsorship_items AS item
  SET
    status = 'open',
    claimed_by_user_id = NULL,
    claimed_at = NULL,
    updated_at = now()
  WHERE item.id = p_item_id
    AND item.status = 'claimed'
    AND NOT EXISTS (
      SELECT 1
      FROM public.sponsorship_item_allocations AS allocation
      WHERE allocation.sponsorship_item_id = item.id
    )
    AND (
      item.claimed_by_user_id = auth.uid()
      OR public.has_fund_permission(item.fund_id, 'manage_sponsorships')
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

-- ---------------------------------------------------------------------------
-- Linked event guests, announcements, and budget
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS event_budgets_manage_related ON public.event_budgets;
CREATE POLICY event_budgets_manage_related ON public.event_budgets
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    public.is_event_creator(event_id)
    OR public.is_event_organiser(event_id)
    OR public.has_linked_event_fund_permission(event_id, 'manage_event_budget')
  )
  WITH CHECK (
    public.is_event_creator(event_id)
    OR public.is_event_organiser(event_id)
    OR public.has_linked_event_fund_permission(event_id, 'manage_event_budget')
  );

DROP POLICY IF EXISTS event_guests_insert_manager ON public.event_guests;
CREATE POLICY event_guests_insert_manager ON public.event_guests
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      public.is_event_creator(event_id)
      OR public.is_event_organiser(event_id)
      OR public.has_linked_event_fund_permission(event_id, 'manage_event_guests')
    )
  );

DROP POLICY IF EXISTS event_guests_select_related ON public.event_guests;
CREATE POLICY event_guests_select_related ON public.event_guests
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_event_creator(event_id)
    OR public.is_event_organiser(event_id)
    OR public.has_linked_event_fund_permission(event_id, 'manage_event_guests')
  );

DROP POLICY IF EXISTS event_guests_update_related ON public.event_guests;
CREATE POLICY event_guests_update_related ON public.event_guests
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_event_creator(event_id)
    OR public.is_event_organiser(event_id)
    OR public.has_linked_event_fund_permission(event_id, 'manage_event_guests')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_event_creator(event_id)
    OR public.is_event_organiser(event_id)
    OR public.has_linked_event_fund_permission(event_id, 'manage_event_guests')
  );

CREATE OR REPLACE FUNCTION public.can_manage_event_announcements(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events AS target_event
    WHERE target_event.id = target_event_id
      AND target_event.deleted_at IS NULL
      AND (
        target_event.creator_id = auth.uid()
        OR public.is_event_organiser(target_event.id)
        OR public.has_linked_event_fund_permission(
          target_event.id,
          'post_event_announcements'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_event_announcements(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_event_announcements(uuid)
  TO authenticated;

-- Keep the legacy role helper for relationship labels only. New operational
-- authorization must call has_fund_permission() with an explicit capability.
COMMENT ON FUNCTION public.is_fund_admin(uuid) IS
  'Returns whether the caller has the admin relationship. Do not use for operational authorization; use has_fund_permission instead.';
