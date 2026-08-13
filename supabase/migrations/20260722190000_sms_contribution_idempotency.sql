-- Make an SMS-detected payment assignable exactly once. The notification and
-- contribution are linked by a stable detection key, and recording updates
-- both records in one server-owned transaction.

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS source_detection_key text;

ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_source_detection_key_length
    CHECK (
      source_detection_key IS NULL
      OR char_length(source_detection_key) BETWEEN 1 AND 300
    ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS contributions_source_detection_key_unique
  ON public.contributions (tagged_by, source_detection_key)
  WHERE source_detection_key IS NOT NULL;

COMMENT ON COLUMN public.contributions.source_detection_key IS
  'Stable device-generated identity for an SMS-detected payment; prevents the same notification being recorded twice.';

-- Notification state is server-owned. Clients may mark a message read, but
-- only the recording/invitation RPCs may set response_action.
REVOKE UPDATE ON TABLE public.notifications FROM anon, authenticated;
REVOKE UPDATE (response_action) ON public.notifications FROM anon, authenticated;
GRANT UPDATE (is_read, read_at, opened_at, clicked_at)
  ON public.notifications TO authenticated;

-- Prevent duplicate in-app notifications if the native listener emits the
-- same detected event more than once.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_sms_detection_key_unique
  ON public.notifications (
    user_id,
    ((data #>> '{detectedSms,detectionKey}'))
  )
  WHERE type = 'sms_detected'::public.notification_type
    AND (data #>> '{detectedSms,detectionKey}') IS NOT NULL;

-- Conservatively reconcile old notifications that were recorded before this
-- link existed. Only a unique exact transaction-reference match is accepted;
-- ambiguous or reference-less history is left untouched for manual review.
WITH candidates AS (
  SELECT
    n.id AS notification_id,
    c.id AS contribution_id,
    count(*) OVER (PARTITION BY n.id) AS notification_matches,
    count(*) OVER (PARTITION BY c.id) AS contribution_matches
  FROM public.notifications n
  JOIN public.contributions c
    ON c.tagged_by = n.user_id
   AND c.detected_via = 'sms'
   AND c.status = 'confirmed'::public.contribution_status
   AND coalesce(c.is_refunded, false) = false
   AND c.amount = CASE
     WHEN (n.data #>> '{detectedSms,amount}') ~ '^[0-9]+([.][0-9]{1,2})?$'
       THEN (n.data #>> '{detectedSms,amount}')::numeric
     ELSE NULL
   END
   AND (
     c.reference_number = n.data #>> '{detectedSms,reference}'
     OR trim(coalesce(c.notes, '')) = 'Ref: ' || trim(n.data #>> '{detectedSms,reference}')
   )
  WHERE n.type = 'sms_detected'::public.notification_type
    AND n.response_action IS NULL
    AND (n.data #>> '{detectedSms,amount}') ~ '^[0-9]+([.][0-9]{1,2})?$'
    AND nullif(trim(n.data #>> '{detectedSms,reference}'), '') IS NOT NULL
    AND c.source_detection_key IS NULL
), unique_matches AS (
  SELECT notification_id, contribution_id
  FROM candidates
  WHERE notification_matches = 1
    AND contribution_matches = 1
)
UPDATE public.contributions c
SET source_detection_key = 'notification:' || matches.notification_id::text
FROM unique_matches matches
WHERE c.id = matches.contribution_id;

UPDATE public.notifications n
SET response_action = 'recorded',
    is_read = true,
    read_at = coalesce(n.read_at, now()),
    fund_id = c.fund_id,
    data = coalesce(n.data, '{}'::jsonb) || jsonb_build_object(
      'recordedContributionId', c.id,
      'recordedFundId', c.fund_id
    )
FROM public.contributions c
WHERE c.source_detection_key = 'notification:' || n.id::text
  AND n.user_id = c.tagged_by;

CREATE OR REPLACE FUNCTION public.create_sms_detected_notification(p_detected jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  amount_text text;
  amount_value numeric(15,2);
  detection_key text;
  sender_label text;
  provider_value text;
  provider_label text;
  clean_payload jsonb;
  created_notification_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_detected IS NULL OR jsonb_typeof(p_detected) <> 'object' THEN
    RAISE EXCEPTION 'Invalid detected payment';
  END IF;

  amount_text := p_detected ->> 'amount';
  IF amount_text IS NULL OR amount_text !~ '^[0-9]+([.][0-9]{1,2})?$' THEN
    RAISE EXCEPTION 'Invalid detected amount';
  END IF;
  amount_value := amount_text::numeric;
  IF amount_value <= 0 OR amount_value > 9999999999999.99 THEN
    RAISE EXCEPTION 'Invalid detected amount';
  END IF;

  detection_key := left(trim(coalesce(
    p_detected ->> 'detectionKey',
    concat_ws('|',
      'sms',
      p_detected ->> 'receivedAt',
      p_detected ->> 'provider',
      p_detected ->> 'reference',
      p_detected ->> 'senderPhone',
      amount_text
    )
  )), 300);
  IF detection_key = '' THEN
    RAISE EXCEPTION 'Detected payment identity is missing';
  END IF;

  provider_value := CASE
    WHEN p_detected ->> 'provider' IN ('orange_money', 'myzaka', 'smega')
      THEN p_detected ->> 'provider'
    ELSE NULL
  END;
  provider_label := CASE provider_value
    WHEN 'orange_money' THEN 'Orange Money'
    WHEN 'myzaka' THEN 'MyZaka'
    WHEN 'smega' THEN 'Smega'
    ELSE 'Mobile Money'
  END;
  sender_label := left(coalesce(
    nullif(trim(p_detected ->> 'senderName'), ''),
    nullif(trim(p_detected ->> 'senderPhone'), ''),
    'an unknown sender'
  ), 100);

  clean_payload := jsonb_strip_nulls(jsonb_build_object(
    'amount', amount_value,
    'senderName', nullif(left(trim(p_detected ->> 'senderName'), 100), ''),
    'senderPhone', nullif(left(trim(p_detected ->> 'senderPhone'), 20), ''),
    'provider', provider_value,
    'reference', nullif(left(trim(p_detected ->> 'reference'), 100), ''),
    'receivedAt', left(coalesce(p_detected ->> 'receivedAt', ''), 40),
    'detectionKey', detection_key
  ));

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      caller_id,
      'sms_detected'::public.notification_type,
      'P' || trim(to_char(amount_value, 'FM9999999999990.00')) || ' received',
      'From ' || sender_label || ' via ' || provider_label || '. Tap to add it to a fund or event.',
      jsonb_build_object('detectedSms', clean_payload, 'suppress_push', true)
    )
    RETURNING id INTO created_notification_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT n.id INTO created_notification_id
    FROM public.notifications n
    WHERE n.user_id = caller_id
      AND n.type = 'sms_detected'::public.notification_type
      AND n.data #>> '{detectedSms,detectionKey}' = detection_key
    LIMIT 1;
  END;

  RETURN created_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sms_detected_notification(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sms_detected_notification(jsonb)
  TO authenticated;

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
    SELECT n.* INTO source_notification
    FROM public.notifications n
    WHERE n.id = p_notification_id
      AND n.user_id = caller_id
      AND n.type = 'sms_detected'::public.notification_type
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

  SELECT c.id, c.fund_id
  INTO contribution_id, existing_fund_id
  FROM public.contributions c
  WHERE c.tagged_by = caller_id
    AND c.source_detection_key = detection_key;

  IF FOUND THEN
    UPDATE public.notifications n
    SET response_action = 'recorded',
        is_read = true,
        read_at = coalesce(n.read_at, now()),
        fund_id = existing_fund_id,
        data = coalesce(n.data, '{}'::jsonb) || jsonb_build_object(
          'recordedContributionId', contribution_id,
          'recordedFundId', existing_fund_id
        )
    WHERE n.user_id = caller_id
      AND (
        n.id = p_notification_id
        OR n.data #>> '{detectedSms,detectionKey}' = detection_key
      );

    RETURN QUERY SELECT contribution_id, existing_fund_id, true;
    RETURN;
  END IF;

  SELECT f.* INTO selected_fund
  FROM public.funds f
  WHERE f.id = p_fund_id
    AND f.deleted_at IS NULL
    AND f.status = 'active'
    AND (
      f.owner_id = caller_id
      OR EXISTS (
        SELECT 1
        FROM public.fund_members manager
        WHERE manager.fund_id = f.id
          AND manager.user_id = caller_id
          AND manager.role IN ('owner'::public.member_role, 'admin'::public.member_role)
          AND manager.status = 'joined'::public.member_status
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an active fund owner or administrator can record received money';
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
    SELECT c.id, c.fund_id
    INTO contribution_id, existing_fund_id
    FROM public.contributions c
    WHERE c.tagged_by = caller_id
      AND c.source_detection_key = detection_key;

    IF contribution_id IS NULL THEN
      RAISE;
    END IF;
  END;

  UPDATE public.notifications n
  SET response_action = 'recorded',
      is_read = true,
      read_at = coalesce(n.read_at, now()),
      fund_id = existing_fund_id,
      data = coalesce(n.data, '{}'::jsonb) || jsonb_build_object(
        'recordedContributionId', contribution_id,
        'recordedFundId', existing_fund_id
      )
  WHERE n.user_id = caller_id
    AND (
      n.id = p_notification_id
      OR n.data #>> '{detectedSms,detectionKey}' = detection_key
    );

  RETURN QUERY SELECT contribution_id, existing_fund_id, was_existing;
END;
$$;

REVOKE ALL ON FUNCTION public.record_detected_contribution(uuid, jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_detected_contribution(uuid, jsonb, uuid)
  TO authenticated;
