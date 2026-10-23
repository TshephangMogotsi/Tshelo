-- Require MFA for platform privileges. Own-role lookup remains available for enrollment.
-- Deploy only after enrollment/recovery readiness; no service-role bypass is added.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_platform_admin(required_roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(auth.jwt()->>'aal', '') = 'aal2' AND EXISTS (
    SELECT 1
    FROM public.platform_admins AS admin
    WHERE admin.user_id = auth.uid()
      AND admin.is_active
      AND (required_roles IS NULL OR admin.role = ANY(required_roles))
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(text[]) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.require_platform_admin_operation(p_operation text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT admin.role
  INTO caller_role
  FROM public.platform_admins AS admin
  WHERE admin.user_id = caller_id
    AND admin.is_active;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Platform administrator access required' USING ERRCODE = '42501';
  END IF;

  IF coalesce(auth.jwt()->>'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Multi-factor verification required' USING ERRCODE = '42501';
  END IF;

  IF NOT (CASE p_operation
    WHEN 'support.update' THEN caller_role IN ('support', 'operations', 'super_admin')
    WHEN 'users.moderate' THEN caller_role IN ('operations', 'super_admin')
    WHEN 'funds.moderate' THEN caller_role IN ('operations', 'super_admin')
    WHEN 'platform_admins.manage' THEN caller_role = 'super_admin'
    ELSE false
  END) THEN
    RAISE EXCEPTION 'Platform administrator role is not authorized for this operation'
      USING ERRCODE = '42501';
  END IF;

  RETURN caller_role;
END;
$$;

REVOKE ALL ON FUNCTION public.require_platform_admin_operation(text)
  FROM PUBLIC, anon, authenticated;


COMMIT;
