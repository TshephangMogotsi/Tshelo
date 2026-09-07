-- Complete event guest management and RSVP foundations.
--
-- The first 100 reserved guest places per event are free. A reserved place is
-- the invited guest plus the greater of their selected and permitted
-- plus-ones. Active Unlimited/Committee passes or a one-time per-event token
-- unlock remove that ceiling.

INSERT INTO public.token_products (
  product_code,
  product_name,
  description,
  token_cost,
  entitlement_type,
  entitlement_quantity,
  is_reward,
  is_active,
  sort_order
)
VALUES (
  'event_guests_above_100',
  'Event Guests Above 100',
  'Increase one event guest list beyond 100 people',
  10,
  'event_guests',
  1,
  false,
  true,
  70
)
ON CONFLICT (product_code) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  description = EXCLUDED.description,
  token_cost = EXCLUDED.token_cost,
  entitlement_type = EXCLUDED.entitlement_type,
  entitlement_quantity = EXCLUDED.entitlement_quantity,
  is_reward = EXCLUDED.is_reward,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

UPDATE public.token_products
SET is_active = false
WHERE product_code = 'event_guests_over_100';

ALTER TABLE public.event_guests
  ADD COLUMN IF NOT EXISTS allowed_plus_ones integer NOT NULL DEFAULT 0;

UPDATE public.event_guests
SET plus_ones = greatest(coalesce(plus_ones, 0), 0),
    allowed_plus_ones = greatest(coalesce(allowed_plus_ones, 0), coalesce(plus_ones, 0), 0),
    plus_ones_names = coalesce(plus_ones_names, '{}'::text[]),
    rsvp_status = coalesce(rsvp_status, 'pending'::public.rsvp_status),
    invited_at = coalesce(invited_at, created_at, now()),
    updated_at = coalesce(updated_at, created_at, now());

ALTER TABLE public.event_guests
  ALTER COLUMN plus_ones SET DEFAULT 0,
  ALTER COLUMN plus_ones SET NOT NULL,
  ALTER COLUMN plus_ones_names SET DEFAULT '{}'::text[],
  ALTER COLUMN plus_ones_names SET NOT NULL,
  ALTER COLUMN rsvp_status SET NOT NULL,
  ALTER COLUMN invited_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_guests_plus_ones_valid'
      AND conrelid = 'public.event_guests'::regclass
  ) THEN
    ALTER TABLE public.event_guests
      ADD CONSTRAINT event_guests_plus_ones_valid
      CHECK (plus_ones BETWEEN 0 AND 20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_guests_allowed_plus_ones_valid'
      AND conrelid = 'public.event_guests'::regclass
  ) THEN
    ALTER TABLE public.event_guests
      ADD CONSTRAINT event_guests_allowed_plus_ones_valid
      CHECK (allowed_plus_ones BETWEEN 0 AND 20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_guests_plus_ones_within_allowance'
      AND conrelid = 'public.event_guests'::regclass
  ) THEN
    ALTER TABLE public.event_guests
      ADD CONSTRAINT event_guests_plus_ones_within_allowance
      CHECK (plus_ones <= allowed_plus_ones);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_guests_invitation_channel_valid'
      AND conrelid = 'public.event_guests'::regclass
  ) THEN
    ALTER TABLE public.event_guests
      ADD CONSTRAINT event_guests_invitation_channel_valid
      CHECK (
        invitation_channel IS NULL
        OR invitation_channel IN ('manual', 'link', 'code', 'whatsapp', 'sms', 'email')
      );
  END IF;
END;
$$;

ALTER TABLE public.token_transactions
  ADD COLUMN IF NOT EXISTS event_id uuid;

ALTER TABLE public.user_entitlements
  ADD COLUMN IF NOT EXISTS event_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'token_transactions_event_id_fkey'
      AND conrelid = 'public.token_transactions'::regclass
  ) THEN
    ALTER TABLE public.token_transactions
      ADD CONSTRAINT token_transactions_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_entitlements_event_id_fkey'
      AND conrelid = 'public.user_entitlements'::regclass
  ) THEN
    ALTER TABLE public.user_entitlements
      ADD CONSTRAINT user_entitlements_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS user_entitlements_event_guest_unlock_unique
  ON public.user_entitlements (event_id)
  WHERE entitlement_type = 'event_guests_above_100' AND event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_guests_event_status_invited_idx
  ON public.event_guests (event_id, rsvp_status, invited_at DESC, id);

CREATE INDEX IF NOT EXISTS user_entitlements_active_pass_idx
  ON public.user_entitlements (user_id, entitlement_type, valid_until)
  WHERE entitlement_type IN ('pass_unlimited_12m', 'pass_committee_12m');

CREATE OR REPLACE FUNCTION public.can_manage_event_guests(p_event_id uuid)
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
      AND (
        target_event.creator_id = auth.uid()
        OR public.is_event_organiser(target_event.id)
        OR public.has_linked_event_fund_permission(target_event.id, 'manage_event_guests')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.event_guest_capacity_source(p_event_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.events AS target_event
      JOIN public.user_entitlements AS pass
        ON pass.user_id = target_event.creator_id
      WHERE target_event.id = p_event_id
        AND target_event.deleted_at IS NULL
        AND pass.entitlement_type IN ('pass_unlimited_12m', 'pass_committee_12m')
        AND pass.valid_from <= now()
        AND (pass.valid_until IS NULL OR pass.valid_until > now())
        AND pass.quantity_total > pass.quantity_used
    ) THEN 'pass'
    WHEN EXISTS (
      SELECT 1
      FROM public.user_entitlements AS event_unlock
      WHERE event_unlock.event_id = p_event_id
        AND event_unlock.entitlement_type = 'event_guests_above_100'
        AND event_unlock.valid_from <= now()
        AND (event_unlock.valid_until IS NULL OR event_unlock.valid_until > now())
        AND event_unlock.quantity_total > event_unlock.quantity_used
    ) THEN 'event_unlock'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.event_guest_capacity_used(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(1 + greatest(guest.plus_ones, guest.allowed_plus_ones)), 0)::integer
  FROM public.event_guests AS guest
  WHERE guest.event_id = p_event_id;
$$;

-- Grandfather events that already exceed the new free limit. This avoids
-- charging retroactively or blocking existing attendees from updating RSVPs.
INSERT INTO public.user_entitlements (
  user_id,
  entitlement_type,
  event_id,
  quantity_total,
  quantity_used,
  source,
  valid_from
)
SELECT
  target_event.creator_id,
  'event_guests_above_100',
  target_event.id,
  1,
  0,
  'legacy_capacity_grant',
  now()
FROM public.events AS target_event
WHERE target_event.deleted_at IS NULL
  AND public.event_guest_capacity_used(target_event.id) > 100
ON CONFLICT (event_id)
  WHERE entitlement_type = 'event_guests_above_100' AND event_id IS NOT NULL
DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_event_guest_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_used integer;
  proposed_used integer;
  old_places integer := 0;
  new_places integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    RAISE EXCEPTION 'EVENT_GUEST_INVALID: An invitation cannot move between events'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.events AS target_event
  WHERE target_event.id = NEW.event_id
    AND target_event.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_GUEST_NOT_FOUND: Event unavailable'
      USING ERRCODE = 'P0002';
  END IF;

  IF public.event_guest_capacity_source(NEW.event_id) IS NOT NULL THEN
    RETURN NEW;
  END IF;

  current_used := public.event_guest_capacity_used(NEW.event_id);
  new_places := 1 + greatest(NEW.plus_ones, NEW.allowed_plus_ones);
  IF TG_OP = 'UPDATE' THEN
    old_places := 1 + greatest(OLD.plus_ones, OLD.allowed_plus_ones);
  END IF;
  proposed_used := current_used - old_places + new_places;

  -- Existing over-limit events and expired passes remain readable and can be
  -- reduced. Only a mutation that increases the occupied capacity is blocked.
  IF proposed_used > 100 AND proposed_used > current_used THEN
    RAISE EXCEPTION 'EVENT_GUEST_CAPACITY_REACHED: Unlock this event to invite more than 100 people'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_event_guest_capacity ON public.event_guests;
CREATE TRIGGER enforce_event_guest_capacity
  BEFORE INSERT OR UPDATE OF event_id, plus_ones, allowed_plus_ones
  ON public.event_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_guest_capacity();

DROP POLICY IF EXISTS event_guests_update_related ON public.event_guests;
CREATE POLICY event_guests_update_manager ON public.event_guests
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_manage_event_guests(event_id))
  WITH CHECK (public.can_manage_event_guests(event_id));

DROP POLICY IF EXISTS event_guests_delete_manager ON public.event_guests;
CREATE POLICY event_guests_delete_manager ON public.event_guests
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.can_manage_event_guests(event_id));

CREATE OR REPLACE FUNCTION public.get_event_guest_overview(p_event_id uuid)
RETURNS TABLE(
  event_id uuid,
  invitation_count integer,
  invited_people integer,
  confirmed_people integer,
  maybe_people integer,
  pending_people integer,
  declined_people integer,
  free_limit integer,
  is_unlimited boolean,
  unlimited_source text,
  unlock_cost_tokens integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  capacity_source text;
  token_cost integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events AS target_event
    WHERE target_event.id = p_event_id AND target_event.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'EVENT_GUEST_NOT_FOUND: Event unavailable'
      USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_manage_event_guests(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_GUEST_FORBIDDEN: Guest-list management permission required'
      USING ERRCODE = '42501';
  END IF;

  capacity_source := public.event_guest_capacity_source(p_event_id);
  SELECT product.token_cost INTO token_cost
  FROM public.token_products AS product
  WHERE product.product_code = 'event_guests_above_100'
    AND product.is_active = true
  LIMIT 1;

  RETURN QUERY
  SELECT
    p_event_id,
    count(guest.id)::integer,
    coalesce(sum(1 + greatest(guest.plus_ones, guest.allowed_plus_ones)), 0)::integer,
    coalesce(sum(CASE WHEN guest.rsvp_status = 'yes' THEN 1 + guest.plus_ones ELSE 0 END), 0)::integer,
    coalesce(sum(CASE WHEN guest.rsvp_status = 'maybe' THEN 1 + guest.plus_ones ELSE 0 END), 0)::integer,
    coalesce(sum(CASE WHEN guest.rsvp_status = 'pending' THEN 1 + greatest(guest.plus_ones, guest.allowed_plus_ones) ELSE 0 END), 0)::integer,
    coalesce(sum(CASE WHEN guest.rsvp_status = 'no' THEN 1 ELSE 0 END), 0)::integer,
    100,
    capacity_source IS NOT NULL,
    capacity_source,
    coalesce(token_cost, 10)
  FROM public.event_guests AS guest
  WHERE guest.event_id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_event_guests(p_event_id uuid, p_guests jsonb)
RETURNS SETOF public.event_guests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_event public.events%ROWTYPE;
  invitee_payload jsonb;
  invitee_name text;
  invitee_phone text;
  invitee_phone_normalized text;
  invitee_email text;
  invitee_channel text;
  invitee_allowed_plus_ones integer;
  invitee_user_id uuid;
  created_guest public.event_guests%ROWTYPE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO target_event
  FROM public.events AS candidate
  WHERE candidate.id = p_event_id
    AND candidate.deleted_at IS NULL
  FOR UPDATE;

  IF target_event.id IS NULL THEN
    RAISE EXCEPTION 'EVENT_GUEST_NOT_FOUND: Event unavailable'
      USING ERRCODE = 'P0002';
  END IF;
  IF target_event.status <> 'active' THEN
    RAISE EXCEPTION 'EVENT_INACTIVE: This event is not accepting invitations'
      USING ERRCODE = '23514';
  END IF;
  IF NOT public.can_manage_event_guests(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_GUEST_FORBIDDEN: Guest-list management permission required'
      USING ERRCODE = '42501';
  END IF;
  IF p_guests IS NULL OR jsonb_typeof(p_guests) <> 'array'
    OR jsonb_array_length(p_guests) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'EVENT_GUEST_INVALID: Invite between 1 and 100 guests at a time'
      USING ERRCODE = '22023';
  END IF;

  FOR invitee_payload IN SELECT value FROM jsonb_array_elements(p_guests)
  LOOP
    IF jsonb_typeof(invitee_payload) <> 'object' THEN
      RAISE EXCEPTION 'EVENT_GUEST_INVALID: Every invitation must be an object'
        USING ERRCODE = '22023';
    END IF;

    invitee_name := trim(coalesce(invitee_payload->>'guest_name', ''));
    invitee_phone := trim(coalesce(invitee_payload->>'guest_phone', ''));
    invitee_phone_normalized := public.normalized_phone(invitee_phone);
    invitee_email := nullif(trim(invitee_payload->>'guest_email'), '');
    invitee_channel := coalesce(nullif(trim(invitee_payload->>'invitation_channel'), ''), 'manual');

    IF coalesce(invitee_payload->>'allowed_plus_ones', '0') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'EVENT_GUEST_INVALID: Plus-one allowance must be an integer'
        USING ERRCODE = '22023';
    END IF;
    invitee_allowed_plus_ones := (coalesce(invitee_payload->>'allowed_plus_ones', '0'))::integer;

    IF length(invitee_name) NOT BETWEEN 1 AND 100
      OR invitee_phone !~ '^\+[1-9][0-9]{6,14}$'
      OR length(invitee_phone_normalized) < 7
      OR invitee_allowed_plus_ones NOT BETWEEN 0 AND 20
      OR invitee_channel NOT IN ('manual', 'link', 'code', 'whatsapp', 'sms', 'email')
      OR (invitee_email IS NOT NULL AND (length(invitee_email) > 255 OR invitee_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) THEN
      RAISE EXCEPTION 'EVENT_GUEST_INVALID: Invitation details are invalid'
        USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.event_guests AS existing_guest
      WHERE existing_guest.event_id = p_event_id
        AND public.normalized_phone(existing_guest.guest_phone) = invitee_phone_normalized
    ) THEN
      RAISE EXCEPTION 'EVENT_GUEST_DUPLICATE: This phone number is already on the guest list'
        USING ERRCODE = '23505';
    END IF;

    SELECT profile.id INTO invitee_user_id
    FROM public.users AS profile
    WHERE public.normalized_phone(profile.phone) = invitee_phone_normalized
      AND profile.is_banned = false
      AND profile.deleted_at IS NULL
    LIMIT 1;

    IF invitee_user_id = target_event.creator_id OR EXISTS (
      SELECT 1 FROM public.event_organisers AS organiser
      WHERE organiser.event_id = p_event_id
        AND organiser.user_id = invitee_user_id
        AND organiser.status NOT IN ('left', 'removed')
    ) THEN
      RAISE EXCEPTION 'EVENT_GUEST_INVALID: Event managers cannot also be invited as guests'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.event_guests (
      event_id,
      user_id,
      guest_name,
      guest_phone,
      guest_email,
      rsvp_status,
      plus_ones,
      allowed_plus_ones,
      plus_ones_names,
      invited_by,
      invited_at,
      invitation_sent_at,
      invitation_channel
    ) VALUES (
      p_event_id,
      invitee_user_id,
      invitee_name,
      invitee_phone,
      invitee_email,
      'pending'::public.rsvp_status,
      0,
      invitee_allowed_plus_ones,
      '{}'::text[],
      caller_id,
      now(),
      CASE WHEN invitee_channel = 'manual' THEN NULL ELSE now() END,
      invitee_channel
    )
    RETURNING * INTO created_guest;

    IF invitee_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        invitee_user_id,
        'join_request'::public.notification_type,
        'Event invitation',
        'You were invited to ' || target_event.name || '.',
        jsonb_build_object(
          'kind', 'event_guest_invite',
          'eventId', target_event.id,
          'guestId', created_guest.id,
          'eventCode', coalesce(target_event.share_code, target_event.event_code)
        )
      );
    END IF;

    RETURN NEXT created_guest;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_event_guest(
  p_event_id uuid,
  p_guest_id uuid,
  p_changes jsonb
)
RETURNS SETOF public.event_guests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_event public.events%ROWTYPE;
  current_guest public.event_guests%ROWTYPE;
  changed_guest public.event_guests%ROWTYPE;
  next_name text;
  next_phone text;
  next_phone_normalized text;
  next_email text;
  next_user_id uuid;
  next_allowed integer;
  next_plus_ones integer;
  next_plus_one_names text[];
  next_status public.rsvp_status;
  next_rsvp_note text;
  next_dietary_requirements text;
  next_accessibility_needs text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'EVENT_GUEST_INVALID: At least one guest change is required'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_changes) AS supplied(field_name)
    WHERE supplied.field_name NOT IN (
      'guest_name', 'guest_phone', 'guest_email', 'rsvp_status', 'plus_ones',
      'allowed_plus_ones', 'plus_ones_names', 'rsvp_note',
      'dietary_requirements', 'accessibility_needs'
    )
  ) THEN
    RAISE EXCEPTION 'EVENT_GUEST_INVALID: Unsupported guest field'
      USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_manage_event_guests(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_GUEST_FORBIDDEN: Guest-list management permission required'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO target_event
  FROM public.events AS candidate
  WHERE candidate.id = p_event_id
    AND candidate.deleted_at IS NULL
  FOR UPDATE;
  IF target_event.id IS NULL THEN
    RAISE EXCEPTION 'EVENT_GUEST_NOT_FOUND: Event unavailable'
      USING ERRCODE = 'P0002';
  END IF;
  IF target_event.status <> 'active' THEN
    RAISE EXCEPTION 'EVENT_INACTIVE: Completed or cancelled events cannot be edited'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO current_guest
  FROM public.event_guests AS candidate
  WHERE candidate.id = p_guest_id
    AND candidate.event_id = p_event_id
  FOR UPDATE;
  IF current_guest.id IS NULL THEN
    RAISE EXCEPTION 'EVENT_GUEST_NOT_FOUND: Guest unavailable'
      USING ERRCODE = 'P0002';
  END IF;

  next_name := CASE WHEN p_changes ? 'guest_name' THEN trim(p_changes->>'guest_name') ELSE current_guest.guest_name END;
  next_phone := CASE WHEN p_changes ? 'guest_phone' THEN trim(p_changes->>'guest_phone') ELSE current_guest.guest_phone END;
  next_phone_normalized := public.normalized_phone(next_phone);
  next_email := CASE WHEN p_changes ? 'guest_email' THEN nullif(trim(p_changes->>'guest_email'), '') ELSE current_guest.guest_email END;
  IF (p_changes ? 'guest_name' AND (next_name IS NULL OR length(next_name) NOT BETWEEN 1 AND 100))
    OR (p_changes ? 'guest_phone' AND (
      next_phone IS NULL OR next_phone !~ '^\+[1-9][0-9]{6,14}$'
      OR length(next_phone_normalized) < 7
    ))
    OR (next_email IS NOT NULL AND (length(next_email) > 255 OR next_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) THEN
    RAISE EXCEPTION 'EVENT_GUEST_INVALID: Guest contact details are invalid'
      USING ERRCODE = '22023';
  END IF;
  IF length(next_phone_normalized) >= 7 AND EXISTS (
    SELECT 1 FROM public.event_guests AS duplicate_guest
    WHERE duplicate_guest.event_id = p_event_id
      AND duplicate_guest.id <> p_guest_id
      AND public.normalized_phone(duplicate_guest.guest_phone) = next_phone_normalized
  ) THEN
    RAISE EXCEPTION 'EVENT_GUEST_DUPLICATE: This phone number is already on the guest list'
      USING ERRCODE = '23505';
  END IF;

  next_allowed := CASE WHEN p_changes ? 'allowed_plus_ones' THEN (p_changes->>'allowed_plus_ones')::integer ELSE current_guest.allowed_plus_ones END;
  next_plus_ones := CASE WHEN p_changes ? 'plus_ones' THEN (p_changes->>'plus_ones')::integer ELSE current_guest.plus_ones END;
  next_status := CASE WHEN p_changes ? 'rsvp_status' THEN (p_changes->>'rsvp_status')::public.rsvp_status ELSE current_guest.rsvp_status END;
  next_plus_one_names := CASE
    WHEN p_changes ? 'plus_ones_names' THEN ARRAY(SELECT jsonb_array_elements_text(p_changes->'plus_ones_names'))
    ELSE current_guest.plus_ones_names
  END;
  next_rsvp_note := CASE WHEN p_changes ? 'rsvp_note' THEN nullif(trim(p_changes->>'rsvp_note'), '') ELSE current_guest.rsvp_note END;
  next_dietary_requirements := CASE WHEN p_changes ? 'dietary_requirements' THEN nullif(trim(p_changes->>'dietary_requirements'), '') ELSE current_guest.dietary_requirements END;
  next_accessibility_needs := CASE WHEN p_changes ? 'accessibility_needs' THEN nullif(trim(p_changes->>'accessibility_needs'), '') ELSE current_guest.accessibility_needs END;

  IF next_status = 'no'::public.rsvp_status THEN
    next_plus_ones := 0;
    next_plus_one_names := '{}'::text[];
  END IF;
  IF next_status IS NULL OR next_allowed IS NULL OR next_plus_ones IS NULL OR next_plus_one_names IS NULL
    OR next_allowed NOT BETWEEN 0 AND 20 OR next_plus_ones NOT BETWEEN 0 AND next_allowed
    OR cardinality(next_plus_one_names) > next_plus_ones
    OR EXISTS (
      SELECT 1 FROM unnest(next_plus_one_names) AS plus_one(name)
      WHERE plus_one.name IS NULL OR length(trim(plus_one.name)) NOT BETWEEN 1 AND 100
    )
    OR coalesce(length(next_rsvp_note), 0) > 2000
    OR coalesce(length(next_dietary_requirements), 0) > 1000
    OR coalesce(length(next_accessibility_needs), 0) > 1000 THEN
    RAISE EXCEPTION 'EVENT_GUEST_INVALID: Plus-one details exceed the invitation allowance'
      USING ERRCODE = '22023';
  END IF;

  next_user_id := current_guest.user_id;
  IF next_user_id IS NULL AND length(next_phone_normalized) >= 7 THEN
    SELECT profile.id INTO next_user_id
    FROM public.users AS profile
    WHERE public.normalized_phone(profile.phone) = next_phone_normalized
      AND profile.is_banned = false
      AND profile.deleted_at IS NULL
    LIMIT 1;
  END IF;
  IF next_user_id = target_event.creator_id OR EXISTS (
    SELECT 1 FROM public.event_organisers AS organiser
    WHERE organiser.event_id = p_event_id
      AND organiser.user_id = next_user_id
      AND organiser.status NOT IN ('left', 'removed')
  ) THEN
    RAISE EXCEPTION 'EVENT_GUEST_INVALID: Event managers cannot also be guests'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.event_guests AS guest
  SET user_id = next_user_id,
      guest_name = next_name,
      guest_phone = next_phone,
      guest_email = next_email,
      rsvp_status = next_status,
      rsvp_responded_at = CASE
        WHEN next_status = 'pending'::public.rsvp_status THEN NULL
        WHEN next_status IS DISTINCT FROM guest.rsvp_status THEN now()
        ELSE guest.rsvp_responded_at
      END,
      plus_ones = next_plus_ones,
      allowed_plus_ones = next_allowed,
      plus_ones_names = next_plus_one_names,
      rsvp_note = next_rsvp_note,
      dietary_requirements = next_dietary_requirements,
      accessibility_needs = next_accessibility_needs,
      updated_at = now()
  WHERE guest.id = p_guest_id
    AND guest.event_id = p_event_id
  RETURNING guest.* INTO changed_guest;

  RETURN NEXT changed_guest;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_event_guest(p_event_id uuid, p_guest_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  removed_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.can_manage_event_guests(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_GUEST_FORBIDDEN: Guest-list management permission required'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events AS target_event
    WHERE target_event.id = p_event_id
      AND target_event.deleted_at IS NULL
      AND target_event.status = 'active'
  ) THEN
    RAISE EXCEPTION 'EVENT_INACTIVE: Active event required'
      USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.event_guests AS guest
  WHERE guest.id = p_guest_id
    AND guest.event_id = p_event_id
  RETURNING guest.id INTO removed_id;

  IF removed_id IS NULL THEN
    RAISE EXCEPTION 'EVENT_GUEST_NOT_FOUND: Guest unavailable'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN removed_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_event_rsvp(
  p_event_id uuid,
  p_code text,
  p_status text,
  p_plus_ones integer DEFAULT 0,
  p_plus_ones_names text[] DEFAULT '{}'::text[],
  p_rsvp_note text DEFAULT NULL,
  p_dietary_requirements text DEFAULT NULL,
  p_accessibility_needs text DEFAULT NULL
)
RETURNS SETOF public.event_guests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_name text;
  caller_phone text;
  caller_phone_normalized text;
  clean_code text := upper(trim(coalesce(p_code, '')));
  target_event public.events%ROWTYPE;
  current_guest public.event_guests%ROWTYPE;
  responded_guest public.event_guests%ROWTYPE;
  response_status public.rsvp_status;
  selected_plus_ones integer := coalesce(p_plus_ones, 0);
  selected_names text[] := coalesce(p_plus_ones_names, '{}'::text[]);
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('yes', 'maybe', 'no') THEN
    RAISE EXCEPTION 'EVENT_RSVP_INVALID: RSVP must be yes, maybe, or no'
      USING ERRCODE = '22023';
  END IF;
  response_status := p_status::public.rsvp_status;

  SELECT * INTO target_event
  FROM public.events AS candidate
  WHERE candidate.id = p_event_id
    AND candidate.deleted_at IS NULL
  FOR UPDATE;
  IF target_event.id IS NULL THEN
    RAISE EXCEPTION 'EVENT_GUEST_NOT_FOUND: Event unavailable'
      USING ERRCODE = 'P0002';
  END IF;
  IF target_event.status <> 'active' THEN
    RAISE EXCEPTION 'EVENT_INACTIVE: This event is no longer accepting RSVPs'
      USING ERRCODE = '23514';
  END IF;
  IF target_event.creator_id = caller_id OR public.is_event_organiser(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_RSVP_INVALID: Event managers cannot RSVP as guests'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_guest
  FROM public.event_guests AS guest
  WHERE guest.event_id = p_event_id
    AND guest.user_id = caller_id
  LIMIT 1
  FOR UPDATE;

  SELECT nullif(trim(profile.name), ''), nullif(trim(profile.phone), '')
  INTO caller_name, caller_phone
  FROM public.users AS profile
  WHERE profile.id = caller_id
    AND profile.is_banned = false
    AND profile.deleted_at IS NULL;
  IF caller_name IS NULL THEN
    RAISE EXCEPTION 'EVENT_RSVP_INVALID: Complete your profile before responding'
      USING ERRCODE = '22023';
  END IF;
  caller_phone_normalized := public.normalized_phone(caller_phone);

  IF current_guest.id IS NULL AND length(caller_phone_normalized) >= 7 THEN
    SELECT * INTO current_guest
    FROM public.event_guests AS guest
    WHERE guest.event_id = p_event_id
      AND guest.user_id IS NULL
      AND public.normalized_phone(guest.guest_phone) = caller_phone_normalized
    ORDER BY guest.invited_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF current_guest.id IS NULL OR current_guest.user_id IS NULL THEN
    IF length(clean_code) < 8
      OR (
        target_event.event_code IS DISTINCT FROM clean_code
        AND target_event.share_code IS DISTINCT FROM clean_code
      ) THEN
      RAISE EXCEPTION 'EVENT_RSVP_CODE_REQUIRED: A valid event invitation code is required'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF current_guest.id IS NULL THEN
    current_guest.allowed_plus_ones := 0;
  END IF;
  IF response_status = 'no'::public.rsvp_status THEN
    selected_plus_ones := 0;
    selected_names := '{}'::text[];
  END IF;
  IF selected_plus_ones NOT BETWEEN 0 AND coalesce(current_guest.allowed_plus_ones, 0)
    OR cardinality(selected_names) > selected_plus_ones
    OR EXISTS (
      SELECT 1 FROM unnest(selected_names) AS plus_one(name)
      WHERE plus_one.name IS NULL OR length(trim(plus_one.name)) NOT BETWEEN 1 AND 100
    )
    OR coalesce(length(p_rsvp_note), 0) > 2000
    OR coalesce(length(p_dietary_requirements), 0) > 1000
    OR coalesce(length(p_accessibility_needs), 0) > 1000 THEN
    RAISE EXCEPTION 'EVENT_RSVP_INVALID: Plus-one details exceed the invitation allowance'
      USING ERRCODE = '22023';
  END IF;

  IF current_guest.id IS NOT NULL THEN
    UPDATE public.event_guests AS guest
    SET user_id = caller_id,
        guest_name = caller_name,
        guest_phone = coalesce(caller_phone, guest.guest_phone),
        rsvp_status = response_status,
        rsvp_responded_at = now(),
        plus_ones = selected_plus_ones,
        plus_ones_names = selected_names,
        rsvp_note = nullif(trim(p_rsvp_note), ''),
        dietary_requirements = nullif(trim(p_dietary_requirements), ''),
        accessibility_needs = nullif(trim(p_accessibility_needs), ''),
        updated_at = now()
    WHERE guest.id = current_guest.id
    RETURNING guest.* INTO responded_guest;
  ELSE
    INSERT INTO public.event_guests (
      event_id,
      user_id,
      guest_name,
      guest_phone,
      rsvp_status,
      rsvp_responded_at,
      plus_ones,
      allowed_plus_ones,
      plus_ones_names,
      rsvp_note,
      dietary_requirements,
      accessibility_needs,
      invited_by,
      invitation_channel
    ) VALUES (
      p_event_id,
      caller_id,
      caller_name,
      caller_phone,
      response_status,
      now(),
      selected_plus_ones,
      0,
      selected_names,
      nullif(trim(p_rsvp_note), ''),
      nullif(trim(p_dietary_requirements), ''),
      nullif(trim(p_accessibility_needs), ''),
      target_event.creator_id,
      'code'
    )
    RETURNING * INTO responded_guest;
  END IF;

  RETURN NEXT responded_guest;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_event_guest_capacity(p_event_id uuid)
RETURNS TABLE(
  event_id uuid,
  is_unlimited boolean,
  tokens_spent integer,
  remaining_tokens integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_event public.events%ROWTYPE;
  token_cost integer;
  current_balance integer;
  next_balance integer;
  token_transaction_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO target_event
  FROM public.events AS candidate
  WHERE candidate.id = p_event_id
    AND candidate.deleted_at IS NULL
  FOR UPDATE;
  IF target_event.id IS NULL THEN
    RAISE EXCEPTION 'EVENT_GUEST_NOT_FOUND: Event unavailable'
      USING ERRCODE = 'P0002';
  END IF;
  IF target_event.creator_id <> caller_id THEN
    RAISE EXCEPTION 'EVENT_GUEST_FORBIDDEN: Only the event creator can spend tokens on capacity'
      USING ERRCODE = '42501';
  END IF;
  IF target_event.status <> 'active' THEN
    RAISE EXCEPTION 'EVENT_INACTIVE: Active event required'
      USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(profile.token_balance, 0) INTO current_balance
  FROM public.users AS profile
  WHERE profile.id = caller_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_GUEST_NOT_FOUND: Profile unavailable'
      USING ERRCODE = 'P0002';
  END IF;

  IF public.event_guest_capacity_source(p_event_id) IS NOT NULL THEN
    RETURN QUERY SELECT p_event_id, true, 0, current_balance;
    RETURN;
  END IF;

  SELECT product.token_cost INTO token_cost
  FROM public.token_products AS product
  WHERE product.product_code = 'event_guests_above_100'
    AND product.is_active = true
  LIMIT 1;
  IF token_cost IS NULL THEN
    RAISE EXCEPTION 'EVENT_GUEST_CAPACITY_UNAVAILABLE: Guest capacity pricing is unavailable'
      USING ERRCODE = '23514';
  END IF;
  IF current_balance < token_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_TOKENS: Guest capacity requires % tokens; current balance is %', token_cost, current_balance
      USING ERRCODE = '23514';
  END IF;

  next_balance := current_balance - token_cost;
  INSERT INTO public.token_transactions (
    user_id,
    amount,
    transaction_type,
    product_code,
    description,
    event_id,
    balance_after
  ) VALUES (
    caller_id,
    -token_cost,
    'spend',
    'event_guests_above_100',
    'Unlock event guest capacity above 100',
    p_event_id,
    next_balance
  )
  RETURNING id INTO token_transaction_id;

  INSERT INTO public.user_entitlements (
    user_id,
    entitlement_type,
    event_id,
    quantity_total,
    quantity_used,
    source,
    source_reference,
    valid_from
  ) VALUES (
    caller_id,
    'event_guests_above_100',
    p_event_id,
    1,
    0,
    'token_purchase',
    token_transaction_id,
    now()
  );

  RETURN QUERY SELECT p_event_id, true, token_cost, next_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_event_guests(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.event_guest_capacity_source(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.event_guest_capacity_used(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_event_guest_capacity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_event_guest_overview(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invite_event_guests(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_event_guest(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_event_guest(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_event_rsvp(uuid, text, text, integer, text[], text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlock_event_guest_capacity(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_manage_event_guests(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_guest_overview(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.invite_event_guests(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_event_guest(uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_event_guest(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_event_rsvp(uuid, text, text, integer, text[], text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlock_event_guest_capacity(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.respond_event_rsvp(uuid, text, text, integer, text[], text, text, text) IS
  'Claims or creates the caller guest record and records an explicit yes, maybe, or no response without granting linked-fund access.';

COMMENT ON FUNCTION public.unlock_event_guest_capacity(uuid) IS
  'Atomically spends the configured token cost once for the creator to unlock an event above the 100-person free guest limit.';
