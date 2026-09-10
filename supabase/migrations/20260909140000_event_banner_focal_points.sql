-- Store a device-independent point of interest for each private event image.
-- The original bytes stay unchanged; clients choose their own responsive crop
-- around these normalized coordinates.
ALTER TABLE public.event_files
  ADD COLUMN banner_focal_x numeric(5,4) NOT NULL DEFAULT 0.5,
  ADD COLUMN banner_focal_y numeric(5,4) NOT NULL DEFAULT 0.5,
  ADD CONSTRAINT event_files_banner_focal_x_valid
    CHECK (banner_focal_x BETWEEN 0 AND 1),
  ADD CONSTRAINT event_files_banner_focal_y_valid
    CHECK (banner_focal_y BETWEEN 0 AND 1);

COMMENT ON COLUMN public.event_files.banner_focal_x IS
  'Normalized horizontal point of interest for responsive banner crops: 0 is left and 1 is right.';
COMMENT ON COLUMN public.event_files.banner_focal_y IS
  'Normalized vertical point of interest for responsive banner crops: 0 is top and 1 is bottom.';

-- Keep set_event_banner(uuid, uuid) unchanged for older API deployments. The
-- focal-aware operation delegates selection and authorization to it, then saves
-- the point in the same transaction. Direct authenticated column updates remain
-- unavailable because no additional table grant is introduced.
CREATE OR REPLACE FUNCTION public.set_event_banner_focal_point(
  p_event_id uuid,
  p_file_id uuid,
  p_focal_x numeric DEFAULT 0.5,
  p_focal_y numeric DEFAULT 0.5
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_file_id IS NOT NULL AND (
    p_focal_x IS NULL OR p_focal_y IS NULL
    OR p_focal_x NOT BETWEEN 0 AND 1
    OR p_focal_y NOT BETWEEN 0 AND 1
  ) THEN
    RAISE EXCEPTION 'EVENT_BANNER_FOCAL_INVALID' USING ERRCODE = '22023';
  END IF;

  -- This function owns the event lock, active-state check, participant privacy,
  -- manager authorization, same-event/image validation and atomic replacement.
  PERFORM public.set_event_banner(p_event_id, p_file_id);

  IF p_file_id IS NOT NULL THEN
    UPDATE public.event_files
      SET banner_focal_x = p_focal_x, banner_focal_y = p_focal_y
      WHERE id = p_file_id AND event_id = p_event_id;
  END IF;

  RETURN jsonb_build_object(
    'file_id', p_file_id,
    'focal_x', CASE WHEN p_file_id IS NULL THEN 0.5 ELSE p_focal_x END,
    'focal_y', CASE WHEN p_file_id IS NULL THEN 0.5 ELSE p_focal_y END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_banner_focal_point(uuid, uuid, numeric, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_banner_focal_point(uuid, uuid, numeric, numeric)
  TO authenticated;
