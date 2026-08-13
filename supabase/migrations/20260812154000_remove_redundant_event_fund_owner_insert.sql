-- Fund creation already has a deferred, atomic owner-membership trigger.
-- Remove the duplicate membership insert from create_event_fund; its conflict
-- target collided with the function's fund_id output variable.

CREATE OR REPLACE FUNCTION public.create_event_fund(
  p_event_name text,
  p_event_type text,
  p_event_emoji text,
  p_event_date date,
  p_event_time time without time zone,
  p_event_venue text,
  p_fund_title text,
  p_currency_code text,
  p_budget numeric,
  p_goal_percentage integer,
  p_is_private boolean DEFAULT false,
  p_organisers jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(
  event_id uuid,
  fund_id uuid,
  fund_code text,
  event_share_code text,
  remaining_tokens integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  token_cost constant integer := 15;
  current_balance integer;
  next_balance integer;
  goal_amount numeric(15,2);
  created_event_id uuid;
  created_fund_id uuid;
  created_fund_code text;
  created_event_share_code text;
  token_transaction_id uuid;
  organiser jsonb;
  organiser_name text;
  organiser_phone text;
  organiser_user_id uuid;
  organiser_invite_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF length(trim(coalesce(p_event_name, ''))) < 3 OR length(p_event_name) > 200 THEN
    RAISE EXCEPTION 'Event name must be between 3 and 200 characters';
  END IF;
  IF length(trim(coalesce(p_fund_title, ''))) < 3 OR length(p_fund_title) > 200 THEN
    RAISE EXCEPTION 'Fund name must be between 3 and 200 characters';
  END IF;
  IF length(trim(coalesce(p_event_type, ''))) < 2 OR length(trim(p_event_type)) > 50 THEN
    RAISE EXCEPTION 'Event type must be between 2 and 50 characters';
  END IF;
  IF trim(p_event_type) ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Event type contains invalid characters';
  END IF;
  IF p_event_date IS NULL OR p_event_date < current_date THEN
    RAISE EXCEPTION 'Event date cannot be in the past';
  END IF;
  IF p_event_time IS NULL THEN
    RAISE EXCEPTION 'Event time is required';
  END IF;
  IF length(trim(coalesce(p_event_venue, ''))) < 3 OR length(p_event_venue) > 200 THEN
    RAISE EXCEPTION 'Venue must be between 3 and 200 characters';
  END IF;
  IF upper(trim(coalesce(p_currency_code, ''))) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid currency code';
  END IF;
  IF p_budget IS NULL OR p_budget <= 0 OR p_budget > 9999999999999.99 THEN
    RAISE EXCEPTION 'Event budget must be greater than zero';
  END IF;
  IF p_goal_percentage IS NULL OR p_goal_percentage NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Fund goal percentage must be between 1 and 100';
  END IF;
  IF p_organisers IS NULL OR jsonb_typeof(p_organisers) <> 'array' OR jsonb_array_length(p_organisers) > 20 THEN
    RAISE EXCEPTION 'Organisers must be an array of no more than 20 people';
  END IF;

  SELECT coalesce(profile.token_balance, 0)
  INTO current_balance
  FROM public.users AS profile
  WHERE profile.id = caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile unavailable';
  END IF;
  IF current_balance < token_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_TOKENS: Event + Fund requires 15 tokens; current balance is %', current_balance;
  END IF;

  goal_amount := round((p_budget * p_goal_percentage / 100), 2);
  next_balance := current_balance - token_cost;

  INSERT INTO public.events AS created_event (
    creator_id, name, event_type, event_emoji, event_date, event_time,
    venue_name, currency_code, status
  ) VALUES (
    caller_id, trim(p_event_name), trim(p_event_type), nullif(trim(p_event_emoji), ''),
    p_event_date, p_event_time, trim(p_event_venue), upper(trim(p_currency_code)), 'active'
  )
  RETURNING created_event.id, created_event.share_code::text
  INTO created_event_id, created_event_share_code;

  INSERT INTO public.funds AS created_fund (
    owner_id, title, fund_type, fund_emoji, goal_amount,
    contribution_deadline, currency_code, status, is_private, linked_event_id
  ) VALUES (
    caller_id, trim(p_fund_title), 'eventFund', nullif(trim(p_event_emoji), ''),
    goal_amount, p_event_date, upper(trim(p_currency_code)), 'active',
    coalesce(p_is_private, false), created_event_id
  )
  RETURNING created_fund.id, created_fund.fund_code::text
  INTO created_fund_id, created_fund_code;

  -- ensure_fund_owner_membership runs as a deferred constraint trigger at
  -- transaction commit, so no second membership insert belongs here.

  INSERT INTO public.token_transactions AS created_transaction (
    user_id, amount, transaction_type, product_code, description, fund_id, balance_after
  ) VALUES (
    caller_id, -token_cost, 'spend', 'event_fund_creation',
    'Create Event + Fund', created_fund_id, next_balance
  )
  RETURNING created_transaction.id INTO token_transaction_id;

  UPDATE public.events AS target_event
  SET linked_fund_id = created_fund_id
  WHERE target_event.id = created_event_id;

  INSERT INTO public.event_fund_links (
    event_id, fund_id, linked_by, link_type, tokens_spent,
    token_transaction_id, is_active
  ) VALUES (
    created_event_id, created_fund_id, caller_id, 'eventFund', token_cost,
    token_transaction_id, true
  );

  INSERT INTO public.event_budgets (
    event_id, total_budget, currency_code, fund_goal_percentage, fund_goal_amount
  ) VALUES (
    created_event_id, p_budget, upper(trim(p_currency_code)), p_goal_percentage, goal_amount
  );

  FOR organiser IN SELECT value FROM jsonb_array_elements(p_organisers)
  LOOP
    organiser_name := left(trim(coalesce(organiser->>'name', '')), 100);
    organiser_phone := public.normalized_phone(organiser->>'phone');
    IF length(organiser_phone) < 7 OR organiser_phone = public.normalized_phone((SELECT profile.phone FROM public.users AS profile WHERE profile.id = caller_id)) THEN
      CONTINUE;
    END IF;

    SELECT profile.id INTO organiser_user_id
    FROM public.users AS profile
    WHERE public.normalized_phone(profile.phone) = organiser_phone
      AND profile.id <> caller_id
    LIMIT 1;

    organiser_invite_id := NULL;
    INSERT INTO public.event_organisers AS created_organiser (
      event_id, user_id, invited_phone, invited_name, role, invited_by, status
    ) VALUES (
      created_event_id, organiser_user_id, organiser_phone,
      nullif(organiser_name, ''), 'organiser'::public.organiser_role,
      caller_id, 'pending'
    )
    ON CONFLICT DO NOTHING
    RETURNING created_organiser.id INTO organiser_invite_id;

    IF organiser_user_id IS NOT NULL AND organiser_invite_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, fund_id, type, title, body, data)
      VALUES (
        organiser_user_id,
        created_fund_id,
        'join_request'::public.notification_type,
        'Event + Fund organiser invitation',
        'You were invited to help manage ' || trim(p_event_name) || ' and its linked fund.',
        jsonb_build_object(
          'kind', 'event_fund_organiser_invite',
          'organiserInviteId', organiser_invite_id,
          'eventId', created_event_id,
          'fundId', created_fund_id
        )
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    created_event_id,
    created_fund_id,
    created_fund_code,
    created_event_share_code,
    next_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.create_event_fund(
  text, text, text, date, time without time zone, text, text, text,
  numeric, integer, boolean, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_event_fund(
  text, text, text, date, time without time zone, text, text, text,
  numeric, integer, boolean, jsonb
) TO authenticated;
