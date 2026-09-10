-- Show an authenticated invitee their personal plus-one allowance before they
-- accept an event invitation. The event code remains a bearer credential, but
-- allowance data is returned only for the caller's existing guest row or an
-- unclaimed invitation matching the caller's verified account phone number.

DROP FUNCTION IF EXISTS public.find_event_by_code(text);

CREATE FUNCTION public.find_event_by_code(p_code text)
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
  already_joined boolean,
  allowed_plus_ones integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  clean_code text := upper(trim(coalesce(p_code, '')));
  caller_phone_normalized text := '';
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF length(clean_code) < 8 THEN
    RAISE EXCEPTION 'Invalid event code';
  END IF;

  SELECT public.normalized_phone(profile.phone)
  INTO caller_phone_normalized
  FROM public.users AS profile
  WHERE profile.id = caller_id
    AND profile.is_banned = false
    AND profile.deleted_at IS NULL;

  RETURN QUERY
  SELECT
    event_record.id,
    event_record.name::text,
    event_record.event_type::text,
    event_record.event_emoji::text,
    event_record.event_date,
    event_record.event_time,
    event_record.venue_name::text,
    event_record.status::text,
    coalesce(nullif(trim(organiser.name), ''), 'Event organiser')::text,
    (event_record.linked_fund_id IS NOT NULL),
    (
      event_record.creator_id = caller_id
      OR EXISTS (
        SELECT 1
        FROM public.event_organisers AS event_organiser
        WHERE event_organiser.event_id = event_record.id
          AND event_organiser.user_id = caller_id
          AND event_organiser.status NOT IN ('left', 'removed')
      )
      OR EXISTS (
        SELECT 1
        FROM public.event_guests AS event_guest
        WHERE event_guest.event_id = event_record.id
          AND event_guest.user_id = caller_id
      )
    ),
    coalesce((
      SELECT event_guest.allowed_plus_ones
      FROM public.event_guests AS event_guest
      WHERE event_guest.event_id = event_record.id
        AND (
          event_guest.user_id = caller_id
          OR (
            event_guest.user_id IS NULL
            AND length(caller_phone_normalized) >= 7
            AND public.normalized_phone(event_guest.guest_phone) = caller_phone_normalized
          )
        )
      ORDER BY (event_guest.user_id = caller_id) DESC NULLS LAST, event_guest.invited_at DESC
      LIMIT 1
    ), 0)::integer
  FROM public.events AS event_record
  LEFT JOIN public.users AS organiser ON organiser.id = event_record.creator_id
  WHERE (event_record.event_code = clean_code OR event_record.share_code = clean_code)
    AND event_record.deleted_at IS NULL
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_event_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_event_by_code(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.find_event_by_code(text) IS
  'Returns a limited event invitation preview and only the caller-matched plus-one allowance';
