-- Allow signed-in users to discover and join events using the RSVP code. Event
-- participation is deliberately separate from membership of a linked fund.

-- Event invite codes are bearer credentials. Keep existing codes valid, while
-- increasing entropy and preventing clients from choosing codes for new events.
CREATE OR REPLACE FUNCTION public.generate_event_code()
RETURNS character varying
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate character varying;
BEGIN
  LOOP
    candidate := 'EVT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE event_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS character varying
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate character varying;
BEGIN
  LOOP
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE share_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_event_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.event_code := public.generate_event_code();
  NEW.share_code := public.generate_share_code();
  RETURN NEW;
END;
$$;

-- Return only the details needed to verify that an invite code points to the
-- expected event. Full event access remains protected by events RLS.
CREATE OR REPLACE FUNCTION public.find_event_by_code(p_code text)
RETURNS TABLE(
  id uuid,
  name text,
  event_type text,
  event_emoji text,
  event_date date,
  event_time time without time zone,
  venue_name text,
  status text,
  organiser_name text,
  has_linked_fund boolean,
  already_joined boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  clean_code text := upper(trim(coalesce(p_code, '')));
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF length(clean_code) < 8 THEN
    RAISE EXCEPTION 'Invalid event code';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name::text,
    e.event_type::text,
    e.event_emoji::text,
    e.event_date,
    e.event_time,
    e.venue_name::text,
    e.status::text,
    coalesce(nullif(trim(u.name), ''), 'Event organiser')::text,
    (e.linked_fund_id IS NOT NULL),
    (
      e.creator_id = caller_id
      OR EXISTS (
        SELECT 1
        FROM public.event_organisers eo
        WHERE eo.event_id = e.id
          AND eo.user_id = caller_id
          AND eo.status NOT IN ('left', 'removed')
      )
      OR EXISTS (
        SELECT 1
        FROM public.event_guests eg
        WHERE eg.event_id = e.id
          AND eg.user_id = caller_id
      )
    )
  FROM public.events e
  LEFT JOIN public.users u ON u.id = e.creator_id
  WHERE (e.event_code = clean_code OR e.share_code = clean_code)
    AND e.deleted_at IS NULL
  LIMIT 1;
END;
$$;

-- Join an event as a confirmed guest. If the organiser already invited the
-- caller's phone number, claim that row so RSVP history and plus-ones survive.
-- This function intentionally never inserts into public.fund_members.
CREATE OR REPLACE FUNCTION public.join_event_by_code(p_code text)
RETURNS TABLE(event_id uuid, guest_id uuid, event_name text, already_joined boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  clean_code text := upper(trim(coalesce(p_code, '')));
  caller_name text;
  caller_phone text;
  caller_phone_normalized text;
  target public.events%ROWTYPE;
  existing public.event_guests%ROWTYPE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF length(clean_code) < 8 THEN
    RAISE EXCEPTION 'Invalid event code';
  END IF;

  SELECT * INTO target
  FROM public.events e
  WHERE (e.event_code = clean_code OR e.share_code = clean_code)
    AND e.deleted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF target.id IS NULL THEN
    RAISE EXCEPTION 'Event is unavailable';
  END IF;
  IF target.status <> 'active' THEN
    RAISE EXCEPTION 'This event is no longer accepting guests';
  END IF;

  IF target.creator_id = caller_id OR EXISTS (
    SELECT 1
    FROM public.event_organisers eo
    WHERE eo.event_id = target.id
      AND eo.user_id = caller_id
      AND eo.status NOT IN ('left', 'removed')
  ) THEN
    RETURN QUERY SELECT target.id, NULL::uuid, target.name::text, true;
    RETURN;
  END IF;

  SELECT * INTO existing
  FROM public.event_guests eg
  WHERE eg.event_id = target.id
    AND eg.user_id = caller_id
  LIMIT 1
  FOR UPDATE;

  IF existing.id IS NOT NULL THEN
    UPDATE public.event_guests
    SET rsvp_status = 'yes'::public.rsvp_status,
        rsvp_responded_at = now(),
        updated_at = now()
    WHERE id = existing.id;

    RETURN QUERY SELECT target.id, existing.id, target.name::text, true;
    RETURN;
  END IF;

  SELECT nullif(trim(u.name), ''), nullif(trim(u.phone), '')
    INTO caller_name, caller_phone
  FROM public.users u
  WHERE u.id = caller_id;

  IF caller_name IS NULL THEN
    RAISE EXCEPTION 'Complete your profile before joining an event';
  END IF;

  caller_phone_normalized := public.normalized_phone(caller_phone);

  IF length(caller_phone_normalized) >= 7 THEN
    SELECT * INTO existing
    FROM public.event_guests eg
    WHERE eg.event_id = target.id
      AND eg.user_id IS NULL
      AND public.normalized_phone(eg.guest_phone) = caller_phone_normalized
    ORDER BY eg.invited_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF existing.id IS NOT NULL THEN
    UPDATE public.event_guests
    SET user_id = caller_id,
        guest_name = caller_name,
        guest_phone = coalesce(caller_phone, guest_phone),
        rsvp_status = 'yes'::public.rsvp_status,
        rsvp_responded_at = now(),
        updated_at = now()
    WHERE id = existing.id;
  ELSE
    INSERT INTO public.event_guests (
      event_id,
      user_id,
      guest_phone,
      guest_name,
      rsvp_status,
      rsvp_responded_at,
      invited_by,
      invitation_channel
    ) VALUES (
      target.id,
      caller_id,
      caller_phone,
      caller_name,
      'yes'::public.rsvp_status,
      now(),
      target.creator_id,
      'code'
    )
    RETURNING * INTO existing;
  END IF;

  RETURN QUERY SELECT target.id, existing.id, target.name::text, false;
END;
$$;

REVOKE ALL ON FUNCTION public.find_event_by_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_event_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_event_by_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_event_by_code(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.join_event_by_code(text) IS
  'Joins the authenticated user to an active event as a confirmed guest without granting linked-fund membership';
