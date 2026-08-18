-- Grant least-privileged platform support access to the existing user selected
-- by the system owner. Resolve and verify the user before changing the
-- allowlist, and attribute the change to the current active super administrator.
DO $$
DECLARE
  target_user_id constant uuid := '41c50f72-8da4-4aa3-8e3a-cafc5b7697fc';
  grantor_user_id uuid;
  target_user public.users%ROWTYPE;
  prior_admin public.platform_admins%ROWTYPE;
  had_prior_admin boolean := false;
BEGIN
  SELECT profile.*
  INTO target_user
  FROM public.users AS profile
  WHERE profile.id = target_user_id
  FOR UPDATE;

  IF NOT FOUND OR target_user.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Target support administrator user not found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(target_user.is_banned, false) THEN
    RAISE EXCEPTION 'A banned user cannot be an active platform administrator'
      USING ERRCODE = '23514';
  END IF;

  SELECT admin.user_id
  INTO grantor_user_id
  FROM public.platform_admins AS admin
  WHERE admin.is_active
    AND admin.role = 'super_admin'
  ORDER BY admin.created_at, admin.user_id
  LIMIT 1;

  IF grantor_user_id IS NULL THEN
    RAISE EXCEPTION 'An active super administrator is required to grant support access'
      USING ERRCODE = '42501';
  END IF;

  SELECT admin.*
  INTO prior_admin
  FROM public.platform_admins AS admin
  WHERE admin.user_id = target_user_id;
  had_prior_admin := FOUND;

  INSERT INTO public.platform_admins AS admin (
    user_id,
    role,
    is_active,
    created_by,
    updated_at
  )
  VALUES (
    target_user_id,
    'support',
    true,
    grantor_user_id,
    now()
  )
  ON CONFLICT ON CONSTRAINT platform_admins_pkey DO UPDATE
  SET role = EXCLUDED.role,
      is_active = true,
      updated_at = now();

  INSERT INTO public.platform_admin_audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    grantor_user_id,
    CASE WHEN had_prior_admin THEN 'platform_admin.updated' ELSE 'platform_admin.created' END,
    'platform_admin',
    target_user_id,
    jsonb_build_object(
      'old', CASE
        WHEN had_prior_admin THEN jsonb_build_object(
          'role', prior_admin.role,
          'status', CASE WHEN prior_admin.is_active THEN 'active' ELSE 'inactive' END
        )
        ELSE NULL
      END,
      'new', jsonb_build_object('role', 'support', 'status', 'active'),
      'source', 'database_migration'
    )
  );
END;
$$;
