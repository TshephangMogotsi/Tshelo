-- Allow one organiser-selected announcement to remain prominent on the event
-- overview. Pin replacement is atomic so concurrent organisers cannot leave an
-- event with multiple pinned updates.

ALTER TABLE public.event_announcements
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS event_announcements_one_pinned_per_event_idx
  ON public.event_announcements(event_id)
  WHERE is_pinned;

COMMENT ON COLUMN public.event_announcements.is_pinned IS
  'True for the single announcement promoted on the event overview.';

CREATE OR REPLACE FUNCTION public.set_event_announcement_pin(
  p_event_id uuid,
  p_announcement_id uuid,
  p_is_pinned boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_event_announcements(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_ANNOUNCEMENT_FORBIDDEN: Update-management permission is required';
  END IF;

  SELECT e.status::text
    INTO target_status
  FROM public.events e
  WHERE e.id = p_event_id
    AND e.deleted_at IS NULL
  FOR UPDATE;

  IF target_status IS NULL THEN
    RAISE EXCEPTION 'EVENT_ANNOUNCEMENT_NOT_FOUND: Event not found';
  END IF;

  IF target_status <> 'active' THEN
    RAISE EXCEPTION 'EVENT_ANNOUNCEMENT_INACTIVE: Completed or cancelled events cannot change pinned updates';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_announcements a
    WHERE a.id = p_announcement_id
      AND a.event_id = p_event_id
  ) THEN
    RETURN false;
  END IF;

  IF p_is_pinned THEN
    UPDATE public.event_announcements
    SET is_pinned = false
    WHERE event_id = p_event_id
      AND is_pinned
      AND id <> p_announcement_id;
  END IF;

  UPDATE public.event_announcements
  SET is_pinned = p_is_pinned
  WHERE id = p_announcement_id
    AND event_id = p_event_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_announcement_pin(uuid, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_announcement_pin(uuid, uuid, boolean)
  TO authenticated;

