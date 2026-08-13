-- Self-service exits preserve financial history while immediately revoking the
-- caller's participation. Linked event and fund memberships remain separate.

-- Permit the server-owned leave function below to demote a departing admin to
-- an ordinary member before marking the membership left. Direct client updates
-- remain blocked by RLS.
CREATE OR REPLACE FUNCTION public.enforce_fund_member_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  caller_is_owner boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.fund_id IS DISTINCT FROM OLD.fund_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
    RAISE EXCEPTION 'Membership identity fields cannot be changed';
  END IF;

  -- A non-owner may leave through the dedicated RPC. Clear any admin role so
  -- the existing membership can safely be restored as a normal member later.
  IF OLD.user_id = auth.uid()
     AND OLD.role <> 'owner'::public.member_role
     AND NEW.status = 'left'::public.member_status
     AND NEW.role = 'member'::public.member_role THEN
    NEW.promoted_by := NULL;
    NEW.promoted_to_admin_at := NULL;
    RETURN NEW;
  END IF;

  caller_is_owner := public.is_fund_owner(OLD.fund_id);

  IF OLD.role = 'owner'::public.member_role
     OR NEW.role = 'owner'::public.member_role THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Fund ownership must be transferred through the ownership workflow';
    END IF;
  END IF;

  IF NOT caller_is_owner AND OLD.role IN ('owner'::public.member_role, 'admin'::public.member_role) THEN
    RAISE EXCEPTION 'Only the fund owner can manage privileged members';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT caller_is_owner THEN
      RAISE EXCEPTION 'Only the fund owner can change member roles';
    END IF;
    IF NEW.role = 'admin'::public.member_role THEN
      NEW.promoted_by := auth.uid();
      NEW.promoted_to_admin_at := now();
    ELSE
      NEW.promoted_by := NULL;
      NEW.promoted_to_admin_at := NULL;
    END IF;
  ELSIF NEW.promoted_by IS DISTINCT FROM OLD.promoted_by
        OR NEW.promoted_to_admin_at IS DISTINCT FROM OLD.promoted_to_admin_at THEN
    RAISE EXCEPTION 'Promotion metadata is server-controlled';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_fund(p_fund_id uuid)
RETURNS TABLE(fund_id uuid, membership_status public.member_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target public.funds%ROWTYPE;
  membership public.fund_members%ROWTYPE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO target
  FROM public.funds f
  WHERE f.id = p_fund_id
    AND f.deleted_at IS NULL
  FOR UPDATE;

  IF target.id IS NULL THEN
    RAISE EXCEPTION 'Fund is unavailable';
  END IF;
  IF target.owner_id = caller_id THEN
    RAISE EXCEPTION 'The fund owner cannot leave. Transfer ownership or close the fund instead.';
  END IF;

  SELECT * INTO membership
  FROM public.fund_members fm
  WHERE fm.fund_id = target.id
    AND fm.user_id = caller_id
    AND fm.status IN ('joined'::public.member_status, 'pending'::public.member_status)
  LIMIT 1
  FOR UPDATE;

  IF membership.id IS NULL THEN
    RAISE EXCEPTION 'You are not an active member of this fund';
  END IF;

  UPDATE public.fund_members
  SET status = 'left'::public.member_status,
      role = 'member'::public.member_role,
      promoted_by = NULL,
      promoted_to_admin_at = NULL,
      updated_at = now()
  WHERE id = membership.id;

  RETURN QUERY SELECT target.id, 'left'::public.member_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_event(p_event_id uuid)
RETURNS TABLE(event_id uuid, left_as_guest boolean, left_as_organiser boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target public.events%ROWTYPE;
  guest_count integer := 0;
  organiser_count integer := 0;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO target
  FROM public.events e
  WHERE e.id = p_event_id
    AND e.deleted_at IS NULL
  FOR UPDATE;

  IF target.id IS NULL THEN
    RAISE EXCEPTION 'Event is unavailable';
  END IF;
  IF target.creator_id = caller_id THEN
    RAISE EXCEPTION 'The event creator cannot leave. Close or delete the event instead.';
  END IF;

  DELETE FROM public.event_guests eg
  WHERE eg.event_id = target.id
    AND eg.user_id = caller_id;
  GET DIAGNOSTICS guest_count = ROW_COUNT;

  UPDATE public.event_organisers eo
  SET status = 'left',
      updated_at = now()
  WHERE eo.event_id = target.id
    AND eo.user_id = caller_id
    AND eo.status NOT IN ('left', 'removed');
  GET DIAGNOSTICS organiser_count = ROW_COUNT;

  IF guest_count = 0 AND organiser_count = 0 THEN
    RAISE EXCEPTION 'You do not have a guest or organiser role to leave for this event';
  END IF;

  RETURN QUERY SELECT target.id, guest_count > 0, organiser_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_fund(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_fund(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_event(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.leave_fund(uuid) IS
  'Marks the authenticated non-owner membership left without deleting financial history';
COMMENT ON FUNCTION public.leave_event(uuid) IS
  'Removes the authenticated non-creator guest role and deactivates their organiser role';
