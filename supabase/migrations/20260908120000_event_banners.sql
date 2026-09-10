-- A banner is a published private event image, not a public URL or a second
-- upload lifecycle. Existing apps may ignore the additive is_banner field.
ALTER TABLE public.event_files
  ADD COLUMN is_banner boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT event_files_banner_image CHECK (
    NOT is_banner OR content_type IN ('image/jpeg', 'image/png', 'image/webp')
  );

CREATE UNIQUE INDEX event_files_one_banner_per_event
  ON public.event_files(event_id) WHERE is_banner;

COMMENT ON COLUMN public.event_files.is_banner IS
  'Selected event cover image. Only set_event_banner may change this field for authenticated callers.';

-- No new table/column write grant: authenticated users retain only the existing
-- file_name update grant. RLS and signed file access keep the banner private.
CREATE OR REPLACE FUNCTION public.set_event_banner(p_event_id uuid, p_file_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_event public.events%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  -- Same lock order as upload finalisation/removal and event completion.
  SELECT * INTO target_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR target_event.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'EVENT_FILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_view_event_files(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF target_event.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'EVENT_FILE_INACTIVE' USING ERRCODE = '23514';
  END IF;
  IF NOT public.can_manage_event_files(p_event_id) THEN
    RAISE EXCEPTION 'EVENT_FILE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_file_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_files
    WHERE id = p_file_id AND event_id = p_event_id
      AND content_type IN ('image/jpeg', 'image/png', 'image/webp')
  ) THEN
    RAISE EXCEPTION 'EVENT_BANNER_INVALID' USING ERRCODE = '22023';
  END IF;

  -- Validate before clearing the old banner. A failed change is atomic, and a
  -- retry of the same selection is safe. Removing a banner preserves its file.
  UPDATE public.event_files SET is_banner = false
    WHERE event_id = p_event_id AND is_banner AND id IS DISTINCT FROM p_file_id;
  UPDATE public.event_files SET is_banner = true
    WHERE event_id = p_event_id AND id = p_file_id AND NOT is_banner;
  RETURN p_file_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_banner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_banner(uuid, uuid) TO authenticated;
