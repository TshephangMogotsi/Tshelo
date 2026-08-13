-- Standalone events can be soft-deleted by their creator. Linked Event + Fund
-- records must continue through their coordinated lifecycle so the fund,
-- ledger, reports, and event cannot be orphaned from one another.

DROP POLICY IF EXISTS events_select_related ON public.events;
CREATE POLICY events_select_related ON public.events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      creator_id = auth.uid()
      OR public.is_event_organiser(id)
      OR public.is_event_guest(id)
    )
  );

DROP POLICY IF EXISTS events_update_related ON public.events;
CREATE POLICY events_update_related ON public.events
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      creator_id = auth.uid()
      OR public.is_event_organiser(id)
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND (
      creator_id = auth.uid()
      OR public.is_event_organiser(id)
    )
  );

CREATE OR REPLACE FUNCTION public.delete_event_only(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  event_row public.events%ROWTYPE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT e.* INTO event_row
  FROM public.events e
  WHERE e.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event unavailable';
  END IF;
  IF event_row.creator_id <> caller_id THEN
    RAISE EXCEPTION 'Only the event creator can delete this event';
  END IF;
  IF event_row.deleted_at IS NOT NULL THEN
    RETURN true;
  END IF;
  IF event_row.linked_fund_id IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM public.event_fund_links link
       WHERE link.event_id = event_row.id
         AND link.is_active = true
     )
     OR EXISTS (
       SELECT 1
       FROM public.funds fund
       WHERE fund.linked_event_id = event_row.id
         AND fund.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'A linked Event + Fund cannot be deleted as an Event only';
  END IF;

  UPDATE public.events
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = event_row.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event_only(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_event_only(uuid) TO authenticated;
