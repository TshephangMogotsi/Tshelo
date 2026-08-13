-- Make Event + Fund creation an atomic, server-owned paid action. The same
-- transaction creates and links both records, stores the budget, records
-- organiser invitations, and debits the immutable token ledger.

CREATE TABLE public.beta_test_token_grants (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 100 CHECK (amount = 100),
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_test_token_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.beta_test_token_grants FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.normalized_phone(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT right(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), 8);
$$;

CREATE OR REPLACE FUNCTION public.claim_beta_test_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  current_balance integer;
  next_balance integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT coalesce(token_balance, 0)
  INTO current_balance
  FROM public.users
  WHERE id = caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile unavailable';
  END IF;

  IF EXISTS (SELECT 1 FROM public.beta_test_token_grants WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'BETA_TOKENS_ALREADY_CLAIMED: This account already received its 100 test tokens';
  END IF;

  next_balance := current_balance + 100;

  INSERT INTO public.beta_test_token_grants (user_id) VALUES (caller_id);
  INSERT INTO public.token_transactions (
    user_id, amount, transaction_type, product_code, description, balance_after
  ) VALUES (
    caller_id, 100, 'beta_test_grant', 'beta_test_tokens_100',
    'One-time internal beta testing credit', next_balance
  );

  RETURN next_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_beta_test_tokens() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_beta_test_tokens() TO authenticated;

-- Search only people with whom the caller already shares an active fund or
-- event. This supports "previous connections" without exposing a global user
-- directory or enabling arbitrary phone-number enumeration.
CREATE OR REPLACE FUNCTION public.search_my_connections(p_query text)
RETURNS TABLE(user_id uuid, name text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  clean_query text := replace(replace(trim(coalesce(p_query, '')), '%', ''), '_', '');
  phone_query text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF length(clean_query) < 2 THEN
    RETURN;
  END IF;

  phone_query := public.normalized_phone(clean_query);

  RETURN QUERY
  SELECT DISTINCT u.id, u.name::text, u.phone::text
  FROM public.users u
  WHERE u.id <> caller_id
    AND (
      u.name ILIKE '%' || clean_query || '%'
      OR (length(phone_query) >= 3 AND public.normalized_phone(u.phone) LIKE '%' || phone_query)
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.fund_members mine
        JOIN public.fund_members theirs ON theirs.fund_id = mine.fund_id
        WHERE mine.user_id = caller_id
          AND mine.status = 'joined'::public.member_status
          AND theirs.user_id = u.id
          AND theirs.status = 'joined'::public.member_status
      )
      OR EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.event_organisers theirs
          ON theirs.event_id = e.id
         AND theirs.user_id = u.id
         AND theirs.status = 'active'
        WHERE e.creator_id = caller_id
          OR EXISTS (
            SELECT 1 FROM public.event_organisers mine
            WHERE mine.event_id = e.id
              AND mine.user_id = caller_id
              AND mine.status = 'active'
          )
      )
    )
  ORDER BY u.name
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.search_my_connections(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_my_connections(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_linked_fund_goal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.funds f
  SET goal_amount = NEW.fund_goal_amount,
      updated_at = now()
  FROM public.events e
  WHERE e.id = NEW.event_id
    AND f.id = e.linked_fund_id
    AND f.deleted_at IS NULL
    AND f.goal_amount IS DISTINCT FROM NEW.fund_goal_amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_linked_fund_goal ON public.event_budgets;
CREATE TRIGGER sync_linked_fund_goal
  AFTER INSERT OR UPDATE OF total_budget, fund_goal_percentage, fund_goal_amount
  ON public.event_budgets
  FOR EACH ROW EXECUTE FUNCTION public.sync_linked_fund_goal();

REVOKE ALL ON FUNCTION public.sync_linked_fund_goal()
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.event_budgets
  ADD CONSTRAINT event_budgets_total_positive
    CHECK (total_budget > 0) NOT VALID,
  ADD CONSTRAINT event_budgets_goal_percentage_valid
    CHECK (fund_goal_percentage BETWEEN 1 AND 100) NOT VALID;

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
  IF p_event_type NOT IN ('wedding', 'funeral', 'graduation', 'birthday', 'baby_shower', 'kitchen_party', 'tombstone', 'other') THEN
    RAISE EXCEPTION 'Unsupported event type';
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

  SELECT coalesce(u.token_balance, 0)
  INTO current_balance
  FROM public.users u
  WHERE u.id = caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile unavailable';
  END IF;
  IF current_balance < token_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_TOKENS: Event + Fund requires 15 tokens; current balance is %', current_balance;
  END IF;

  goal_amount := round((p_budget * p_goal_percentage / 100), 2);
  next_balance := current_balance - token_cost;

  INSERT INTO public.events (
    creator_id, name, event_type, event_emoji, event_date, event_time,
    venue_name, currency_code, status
  ) VALUES (
    caller_id, trim(p_event_name), p_event_type, nullif(trim(p_event_emoji), ''),
    p_event_date, p_event_time, trim(p_event_venue), upper(trim(p_currency_code)), 'active'
  )
  RETURNING id, share_code::text INTO created_event_id, created_event_share_code;

  INSERT INTO public.funds (
    owner_id, title, fund_type, fund_emoji, goal_amount,
    contribution_deadline, currency_code, status, is_private, linked_event_id
  ) VALUES (
    caller_id, trim(p_fund_title), 'eventFund', nullif(trim(p_event_emoji), ''),
    goal_amount, p_event_date, upper(trim(p_currency_code)), 'active',
    coalesce(p_is_private, false), created_event_id
  )
  RETURNING id, fund_code::text INTO created_fund_id, created_fund_code;

  INSERT INTO public.fund_members (
    fund_id, user_id, invited_by, role, status, joined_at
  ) VALUES (
    created_fund_id, caller_id, caller_id,
    'owner'::public.member_role, 'joined'::public.member_status, now()
  );

  INSERT INTO public.token_transactions (
    user_id, amount, transaction_type, product_code, description, fund_id, balance_after
  ) VALUES (
    caller_id, -token_cost, 'spend', 'event_fund_creation',
    'Create Event + Fund', created_fund_id, next_balance
  ) RETURNING id INTO token_transaction_id;

  UPDATE public.events SET linked_fund_id = created_fund_id WHERE id = created_event_id;

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
    IF length(organiser_phone) < 7 OR organiser_phone = public.normalized_phone((SELECT phone FROM public.users WHERE id = caller_id)) THEN
      CONTINUE;
    END IF;

    SELECT u.id INTO organiser_user_id
    FROM public.users u
    WHERE public.normalized_phone(u.phone) = organiser_phone
      AND u.id <> caller_id
    LIMIT 1;

    organiser_invite_id := NULL;
    INSERT INTO public.event_organisers (
      event_id, user_id, invited_phone, invited_name, role, invited_by, status
    ) VALUES (
      created_event_id, organiser_user_id, organiser_phone,
      nullif(organiser_name, ''), 'organiser'::public.organiser_role,
      caller_id, 'pending'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO organiser_invite_id;

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

CREATE OR REPLACE FUNCTION public.invite_event_fund_organiser(
  p_event_id uuid,
  p_name text,
  p_phone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_fund_id uuid;
  clean_phone text := public.normalized_phone(p_phone);
  target_user_id uuid;
  invite_id uuid;
  event_name text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF length(clean_phone) < 7 THEN
    RAISE EXCEPTION 'A valid organiser phone number is required';
  END IF;

  SELECT e.linked_fund_id, e.name
  INTO target_fund_id, event_name
  FROM public.events e
  JOIN public.funds f ON f.id = e.linked_fund_id
  WHERE e.id = p_event_id
    AND e.creator_id = caller_id
    AND f.owner_id = caller_id
    AND e.deleted_at IS NULL
    AND f.deleted_at IS NULL;

  IF target_fund_id IS NULL THEN
    RAISE EXCEPTION 'Only the Event + Fund owner can invite organisers';
  END IF;
  IF clean_phone = public.normalized_phone((SELECT phone FROM public.users WHERE id = caller_id)) THEN
    RAISE EXCEPTION 'You already manage this Event + Fund';
  END IF;

  SELECT eo.id INTO invite_id
  FROM public.event_organisers eo
  WHERE eo.event_id = p_event_id
    AND public.normalized_phone(eo.invited_phone) = clean_phone
    AND eo.status IN ('pending', 'active')
  LIMIT 1;

  IF invite_id IS NOT NULL THEN
    RAISE EXCEPTION 'This person already has an organiser invitation';
  END IF;

  SELECT u.id INTO target_user_id
  FROM public.users u
  WHERE public.normalized_phone(u.phone) = clean_phone
  LIMIT 1;

  INSERT INTO public.event_organisers (
    event_id, user_id, invited_phone, invited_name, role, invited_by, status
  ) VALUES (
    p_event_id, target_user_id, clean_phone, left(nullif(trim(p_name), ''), 100),
    'organiser'::public.organiser_role, caller_id, 'pending'
  ) RETURNING id INTO invite_id;

  IF target_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, fund_id, type, title, body, data)
    VALUES (
      target_user_id, target_fund_id, 'join_request'::public.notification_type,
      'Event + Fund organiser invitation',
      'You were invited to help manage ' || event_name || ' and its linked fund.',
      jsonb_build_object(
        'kind', 'event_fund_organiser_invite',
        'organiserInviteId', invite_id,
        'eventId', p_event_id,
        'fundId', target_fund_id
      )
    );
  END IF;

  RETURN invite_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_event_fund_organiser(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_event_fund_organiser(uuid, text, text)
  TO authenticated;

-- If a contact was invited before registering, safely attach the pending
-- invitation to the account whose server-owned profile phone now matches.
CREATE OR REPLACE FUNCTION public.sync_my_event_fund_organiser_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_phone text;
  invitation record;
  synced_count integer := 0;
BEGIN
  IF caller_id IS NULL THEN RETURN 0; END IF;
  SELECT public.normalized_phone(phone) INTO caller_phone
  FROM public.users WHERE id = caller_id;
  IF length(caller_phone) < 7 THEN RETURN 0; END IF;

  FOR invitation IN
    SELECT eo.id, eo.event_id, e.linked_fund_id AS fund_id, e.name
    FROM public.event_organisers eo
    JOIN public.events e ON e.id = eo.event_id
    WHERE eo.user_id IS NULL
      AND eo.status = 'pending'
      AND e.linked_fund_id IS NOT NULL
      AND public.normalized_phone(eo.invited_phone) = caller_phone
  LOOP
    UPDATE public.event_organisers SET user_id = caller_id, updated_at = now()
    WHERE id = invitation.id AND user_id IS NULL;

    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = caller_id
        AND n.data->>'organiserInviteId' = invitation.id::text
    ) THEN
      INSERT INTO public.notifications (user_id, fund_id, type, title, body, data)
      VALUES (
        caller_id, invitation.fund_id, 'join_request'::public.notification_type,
        'Event + Fund organiser invitation',
        'You were invited to help manage ' || invitation.name || ' and its linked fund.',
        jsonb_build_object(
          'kind', 'event_fund_organiser_invite',
          'organiserInviteId', invitation.id,
          'eventId', invitation.event_id,
          'fundId', invitation.fund_id
        )
      );
    END IF;
    synced_count := synced_count + 1;
  END LOOP;

  RETURN synced_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_my_event_fund_organiser_invites()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_event_fund_organiser_invites()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_event_fund_organiser_invite(
  p_invite_id uuid,
  p_accept boolean
)
RETURNS TABLE(event_id uuid, fund_id uuid, accepted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_phone text;
  target_event_id uuid;
  target_fund_id uuid;
  inviter_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT public.normalized_phone(phone) INTO caller_phone
  FROM public.users WHERE id = caller_id;

  SELECT eo.event_id, coalesce(e.linked_fund_id, efl.fund_id), eo.invited_by
  INTO target_event_id, target_fund_id, inviter_id
  FROM public.event_organisers eo
  JOIN public.events e ON e.id = eo.event_id
  LEFT JOIN public.event_fund_links efl ON efl.event_id = eo.event_id AND efl.is_active = true
  WHERE eo.id = p_invite_id
    AND eo.status = 'pending'
    AND (
      eo.user_id = caller_id
      OR (eo.user_id IS NULL AND length(caller_phone) >= 7 AND public.normalized_phone(eo.invited_phone) = caller_phone)
    )
  FOR UPDATE OF eo;

  IF target_event_id IS NULL OR target_fund_id IS NULL THEN
    RAISE EXCEPTION 'This organiser invitation is unavailable';
  END IF;

  IF coalesce(p_accept, false) THEN
    UPDATE public.event_organisers
    SET user_id = caller_id, status = 'active', joined_at = now(), updated_at = now()
    WHERE id = p_invite_id;

    DELETE FROM public.fund_members
    WHERE fund_id = target_fund_id
      AND user_id = caller_id
      AND role <> 'owner'::public.member_role;

    INSERT INTO public.fund_members (
      fund_id, user_id, invited_by, role, status, joined_at,
      promoted_to_admin_at, promoted_by
    ) VALUES (
      target_fund_id, caller_id, inviter_id, 'admin'::public.member_role,
      'joined'::public.member_status, now(), now(), inviter_id
    );
  ELSE
    UPDATE public.event_organisers
    SET user_id = caller_id, status = 'declined', updated_at = now()
    WHERE id = p_invite_id;
  END IF;

  UPDATE public.notifications
  SET response_action = CASE WHEN coalesce(p_accept, false) THEN 'accepted' ELSE 'declined' END,
      is_read = true,
      read_at = now()
  WHERE user_id = caller_id
    AND data->>'organiserInviteId' = p_invite_id::text;

  RETURN QUERY SELECT target_event_id, target_fund_id, coalesce(p_accept, false);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_event_fund_organiser_invite(uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_event_fund_organiser_invite(uuid, boolean)
  TO authenticated;
