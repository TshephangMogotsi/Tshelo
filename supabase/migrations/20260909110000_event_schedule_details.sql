-- First-class schedule metadata for accurate event countdowns, RSVP cut-offs,
-- and portable calendar exports. Event times remain local wall-clock values;
-- time_zone says which IANA zone those values belong to.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Africa/Gaborone',
  ADD COLUMN IF NOT EXISTS rsvp_deadline date;

COMMENT ON COLUMN public.events.time_zone IS
  'IANA time-zone name used to interpret the event start and end wall-clock times.';
COMMENT ON COLUMN public.events.rsvp_deadline IS
  'Optional final local calendar day on which attendee RSVP responses are accepted.';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_time_zone_length,
  ADD CONSTRAINT events_time_zone_length
    CHECK (char_length(time_zone) BETWEEN 1 AND 100),
  DROP CONSTRAINT IF EXISTS events_rsvp_deadline_order,
  ADD CONSTRAINT events_rsvp_deadline_order
    CHECK (rsvp_deadline IS NULL OR rsvp_deadline <= event_date);

CREATE OR REPLACE FUNCTION public.enforce_event_schedule_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names AS zone
    WHERE zone.name = NEW.time_zone
  ) THEN
    RAISE EXCEPTION 'EVENT_TIME_ZONE_INVALID: Use a recognised IANA time zone'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.event_end_date IS NOT NULL AND NEW.event_end_date < NEW.event_date THEN
    RAISE EXCEPTION 'EVENT_SCHEDULE_INVALID: Event end date cannot precede its start date'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(NEW.event_end_date, NEW.event_date) = NEW.event_date
     AND NEW.event_time IS NOT NULL
     AND NEW.event_end_time IS NOT NULL
     AND NEW.event_end_time < NEW.event_time THEN
    RAISE EXCEPTION 'EVENT_SCHEDULE_INVALID: Event end time cannot precede its start time'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_event_schedule_details ON public.events;
CREATE TRIGGER enforce_event_schedule_details
  BEFORE INSERT OR UPDATE OF event_date, event_time, event_end_date,
    event_end_time, time_zone, rsvp_deadline
  ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_schedule_details();

-- The attendee RSVP RPC writes the caller's own guest row. Enforce the deadline
-- at the table boundary as well, while retaining organiser guest-list edits.
CREATE OR REPLACE FUNCTION public.enforce_event_rsvp_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_event public.events%ROWTYPE;
BEGIN
  IF caller_id IS NULL
     OR NEW.user_id IS DISTINCT FROM caller_id
     OR NEW.rsvp_status::text = 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT event_row.*
  INTO target_event
  FROM public.events AS event_row
  WHERE event_row.id = NEW.event_id
    AND event_row.deleted_at IS NULL;

  IF target_event.id IS NULL
     OR target_event.creator_id = caller_id
     OR public.is_event_organiser(NEW.event_id) THEN
    RETURN NEW;
  END IF;

  IF target_event.rsvp_deadline IS NOT NULL
     AND (CURRENT_TIMESTAMP AT TIME ZONE target_event.time_zone)::date
       > target_event.rsvp_deadline THEN
    RAISE EXCEPTION 'EVENT_RSVP_DEADLINE_PASSED: This event is no longer accepting RSVPs'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_event_rsvp_deadline ON public.event_guests;
CREATE TRIGGER enforce_event_rsvp_deadline
  BEFORE INSERT OR UPDATE OF rsvp_status, plus_ones, plus_ones_names,
    rsvp_note, dietary_requirements, accessibility_needs
  ON public.event_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_rsvp_deadline();

REVOKE ALL ON FUNCTION public.enforce_event_schedule_details()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_event_rsvp_deadline()
  FROM PUBLIC, anon, authenticated;
