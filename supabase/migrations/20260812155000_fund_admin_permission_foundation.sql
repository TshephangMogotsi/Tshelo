-- Phase 1 of granular fund administration. Roles continue to describe a
-- person's relationship to the fund; these capability grants describe the
-- specific operations an admin may perform. Existing authorization policies
-- remain unchanged until the capability-aware policy migration is deployed.

CREATE TABLE public.fund_permission_definitions (
  permission_key text PRIMARY KEY,
  category text NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fund_permission_key_format
    CHECK (permission_key ~ '^[a-z][a-z0-9_]{2,49}$'),
  CONSTRAINT fund_permission_category_valid
    CHECK (category IN ('money', 'members', 'operations', 'event'))
);

INSERT INTO public.fund_permission_definitions (
  permission_key, category, label, description, sort_order
) VALUES
  ('record_contributions', 'money', 'Record contributions', 'Record received money and assign detected mobile-money payments.', 10),
  ('edit_contributions', 'money', 'Edit contributions', 'Correct existing contribution records. Refunds remain owner-only.', 20),
  ('record_expenses', 'money', 'Record expenses', 'Add expenses paid by the fund.', 30),
  ('edit_expenses', 'money', 'Edit expenses', 'Correct or remove existing expense records.', 40),
  ('manage_members', 'members', 'Manage members', 'Invite, approve, reject, and remove ordinary members.', 50),
  ('manage_sponsorships', 'operations', 'Manage sponsorships', 'Create, edit, allocate, and fulfil sponsorship items.', 60),
  ('award_recognition', 'operations', 'Award recognition', 'Award Rich Auntie recognition to eligible members.', 70),
  ('export_reports', 'operations', 'Export reports', 'Generate detailed PDF and CSV fund reports.', 80),
  ('manage_event_guests', 'event', 'Manage event guests', 'Invite and manage guests for the linked event.', 90),
  ('post_event_announcements', 'event', 'Post announcements', 'Publish announcements for the linked event.', 100),
  ('manage_event_budget', 'event', 'Manage event budget', 'Edit the budget for the linked event.', 110);

CREATE TABLE public.fund_admin_permissions (
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.fund_permission_definitions(permission_key),
  granted_by uuid NOT NULL REFERENCES public.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fund_id, user_id, permission_key)
);

CREATE INDEX fund_admin_permissions_user_fund_idx
  ON public.fund_admin_permissions(user_id, fund_id);

COMMENT ON TABLE public.fund_admin_permissions IS
  'Owner-granted operational capabilities for joined fund admins; ownership powers are never represented here';

ALTER TABLE public.fund_permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_admin_permissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fund_permission_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fund_admin_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fund_permission_definitions TO authenticated;
GRANT SELECT ON TABLE public.fund_admin_permissions TO authenticated;

CREATE POLICY fund_permission_definitions_select
  ON public.fund_permission_definitions
  FOR SELECT TO authenticated
  USING (is_active);

CREATE POLICY fund_admin_permissions_select_related
  ON public.fund_admin_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_fund_owner(fund_id)
  );

-- Owners always have every delegatable capability. Admins receive only their
-- explicit grants. Ordinary members never gain operational access here.
CREATE OR REPLACE FUNCTION public.has_fund_permission(
  p_fund_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.funds AS target_fund
    WHERE target_fund.id = p_fund_id
      AND target_fund.deleted_at IS NULL
      AND (
        target_fund.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.fund_members AS admin_membership
          JOIN public.fund_admin_permissions AS permission_grant
            ON permission_grant.fund_id = admin_membership.fund_id
           AND permission_grant.user_id = admin_membership.user_id
          JOIN public.fund_permission_definitions AS definition
            ON definition.permission_key = permission_grant.permission_key
           AND definition.is_active
          WHERE admin_membership.fund_id = target_fund.id
            AND admin_membership.user_id = auth.uid()
            AND admin_membership.role = 'admin'::public.member_role
            AND admin_membership.status = 'joined'::public.member_status
            AND permission_grant.permission_key = p_permission_key
        )
      )
  );
$$;

-- A single read gives the app its effective capability set. Owners receive the
-- full active catalogue; admins receive their active grants; members get none.
CREATE OR REPLACE FUNCTION public.get_my_fund_permissions(p_fund_id uuid)
RETURNS TABLE(permission_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT definition.permission_key
  FROM public.fund_permission_definitions AS definition
  WHERE definition.is_active
    AND (
      EXISTS (
        SELECT 1
        FROM public.funds AS owned_fund
        WHERE owned_fund.id = p_fund_id
          AND owned_fund.owner_id = auth.uid()
          AND owned_fund.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.fund_members AS admin_membership
        JOIN public.fund_admin_permissions AS permission_grant
          ON permission_grant.fund_id = admin_membership.fund_id
         AND permission_grant.user_id = admin_membership.user_id
         AND permission_grant.permission_key = definition.permission_key
        WHERE admin_membership.fund_id = p_fund_id
          AND admin_membership.user_id = auth.uid()
          AND admin_membership.role = 'admin'::public.member_role
          AND admin_membership.status = 'joined'::public.member_status
      )
    )
  ORDER BY definition.sort_order;
$$;

-- Owners use this read to populate the permission editor for all current
-- admins without granting ordinary members visibility into other admins.
CREATE OR REPLACE FUNCTION public.get_fund_admin_permissions(p_fund_id uuid)
RETURNS TABLE(member_id uuid, admin_user_id uuid, permission_key text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_fund_owner(p_fund_id) THEN
    RAISE EXCEPTION 'Only the fund owner can view admin permissions';
  END IF;

  RETURN QUERY
  SELECT
    membership.id,
    membership.user_id,
    permission_grant.permission_key
  FROM public.fund_members AS membership
  LEFT JOIN public.fund_admin_permissions AS permission_grant
    ON permission_grant.fund_id = membership.fund_id
   AND permission_grant.user_id = membership.user_id
  WHERE membership.fund_id = p_fund_id
    AND membership.role = 'admin'::public.member_role
    AND membership.status = 'joined'::public.member_status
  ORDER BY membership.joined_at, permission_grant.permission_key;
END;
$$;

-- Promotion and permission assignment are one transaction. This avoids an
-- admin temporarily holding a role with an undefined permission set.
CREATE OR REPLACE FUNCTION public.configure_fund_admin(
  p_member_id uuid,
  p_permissions text[]
)
RETURNS TABLE(member_id uuid, admin_user_id uuid, permission_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_membership public.fund_members%ROWTYPE;
  requested_permissions text[];
  invalid_permissions text[];
  previous_permissions text[];
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO target_membership
  FROM public.fund_members AS membership
  WHERE membership.id = p_member_id
  FOR UPDATE;

  IF target_membership.id IS NULL
     OR target_membership.status <> 'joined'::public.member_status
     OR target_membership.user_id IS NULL THEN
    RAISE EXCEPTION 'A joined fund member is required';
  END IF;
  IF NOT public.is_fund_owner(target_membership.fund_id) THEN
    RAISE EXCEPTION 'Only the fund owner can configure admins';
  END IF;
  IF target_membership.user_id = caller_id
     OR target_membership.role = 'owner'::public.member_role THEN
    RAISE EXCEPTION 'Owner permissions cannot be changed';
  END IF;

  SELECT coalesce(array_agg(DISTINCT requested.permission_key ORDER BY requested.permission_key), ARRAY[]::text[])
  INTO requested_permissions
  FROM unnest(coalesce(p_permissions, ARRAY[]::text[])) AS requested(permission_key)
  WHERE nullif(trim(requested.permission_key), '') IS NOT NULL;

  IF cardinality(requested_permissions) = 0 THEN
    RAISE EXCEPTION 'Select at least one admin permission';
  END IF;

  SELECT coalesce(array_agg(requested.permission_key ORDER BY requested.permission_key), ARRAY[]::text[])
  INTO invalid_permissions
  FROM unnest(requested_permissions) AS requested(permission_key)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.fund_permission_definitions AS definition
    WHERE definition.permission_key = requested.permission_key
      AND definition.is_active
  );

  IF cardinality(invalid_permissions) > 0 THEN
    RAISE EXCEPTION 'Unknown admin permissions: %', array_to_string(invalid_permissions, ', ');
  END IF;

  SELECT coalesce(array_agg(existing.permission_key ORDER BY existing.permission_key), ARRAY[]::text[])
  INTO previous_permissions
  FROM public.fund_admin_permissions AS existing
  WHERE existing.fund_id = target_membership.fund_id
    AND existing.user_id = target_membership.user_id;

  UPDATE public.fund_members AS membership
  SET role = 'admin'::public.member_role,
      promoted_by = caller_id,
      promoted_to_admin_at = coalesce(membership.promoted_to_admin_at, now()),
      updated_at = now()
  WHERE membership.id = target_membership.id;

  DELETE FROM public.fund_admin_permissions AS existing
  WHERE existing.fund_id = target_membership.fund_id
    AND existing.user_id = target_membership.user_id;

  INSERT INTO public.fund_admin_permissions (
    fund_id, user_id, permission_key, granted_by
  )
  SELECT
    target_membership.fund_id,
    target_membership.user_id,
    requested.permission_key,
    caller_id
  FROM unnest(requested_permissions) AS requested(permission_key);

  INSERT INTO public.audit_log (
    fund_id, user_id, action, entity_type, entity_id, old_values, new_values
  ) VALUES (
    target_membership.fund_id,
    caller_id,
    'permissions_changed',
    'fund_admin',
    target_membership.id,
    jsonb_build_object('role', target_membership.role::text, 'permissions', to_jsonb(previous_permissions)),
    jsonb_build_object('role', 'admin', 'permissions', to_jsonb(requested_permissions))
  );

  RETURN QUERY
  SELECT target_membership.id, target_membership.user_id, requested.permission_key
  FROM unnest(requested_permissions) AS requested(permission_key)
  ORDER BY requested.permission_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_fund_admin(p_member_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_membership public.fund_members%ROWTYPE;
  previous_permissions text[];
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO target_membership
  FROM public.fund_members AS membership
  WHERE membership.id = p_member_id
  FOR UPDATE;

  IF target_membership.id IS NULL
     OR target_membership.role <> 'admin'::public.member_role
     OR target_membership.status <> 'joined'::public.member_status THEN
    RAISE EXCEPTION 'An active fund admin is required';
  END IF;
  IF NOT public.is_fund_owner(target_membership.fund_id) THEN
    RAISE EXCEPTION 'Only the fund owner can remove admin access';
  END IF;

  SELECT coalesce(array_agg(existing.permission_key ORDER BY existing.permission_key), ARRAY[]::text[])
  INTO previous_permissions
  FROM public.fund_admin_permissions AS existing
  WHERE existing.fund_id = target_membership.fund_id
    AND existing.user_id = target_membership.user_id;

  DELETE FROM public.fund_admin_permissions AS existing
  WHERE existing.fund_id = target_membership.fund_id
    AND existing.user_id = target_membership.user_id;

  UPDATE public.fund_members AS membership
  SET role = 'member'::public.member_role,
      promoted_by = NULL,
      promoted_to_admin_at = NULL,
      updated_at = now()
  WHERE membership.id = target_membership.id;

  INSERT INTO public.audit_log (
    fund_id, user_id, action, entity_type, entity_id, old_values, new_values
  ) VALUES (
    target_membership.fund_id,
    caller_id,
    'permissions_changed',
    'fund_admin',
    target_membership.id,
    jsonb_build_object('role', 'admin', 'permissions', to_jsonb(previous_permissions)),
    jsonb_build_object('role', 'member', 'permissions', '[]'::jsonb)
  );

  RETURN target_membership.id;
END;
$$;

-- Compatibility guard: until the new editor is live, admins promoted by the
-- old role toggle receive the full active catalogue. Demotion or departure
-- removes dormant grants. configure_fund_admin replaces these full grants with
-- the owner's selected set inside the same transaction.
CREATE OR REPLACE FUNCTION public.sync_fund_admin_permission_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin'::public.member_role
     AND NEW.status = 'joined'::public.member_status
     AND (
       OLD.role IS DISTINCT FROM NEW.role
       OR OLD.status IS DISTINCT FROM NEW.status
     ) THEN
    INSERT INTO public.fund_admin_permissions (
      fund_id, user_id, permission_key, granted_by
    )
    SELECT NEW.fund_id, NEW.user_id, definition.permission_key, coalesce(auth.uid(), NEW.promoted_by, NEW.invited_by)
    FROM public.fund_permission_definitions AS definition
    WHERE definition.is_active
      AND NEW.user_id IS NOT NULL
      AND coalesce(auth.uid(), NEW.promoted_by, NEW.invited_by) IS NOT NULL
    ON CONFLICT (fund_id, user_id, permission_key) DO NOTHING;
  ELSIF NEW.role <> 'admin'::public.member_role
        OR NEW.status <> 'joined'::public.member_status THEN
    DELETE FROM public.fund_admin_permissions AS existing
    WHERE existing.fund_id = NEW.fund_id
      AND existing.user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_fund_admin_permission_compatibility ON public.fund_members;
CREATE TRIGGER sync_fund_admin_permission_compatibility
  AFTER UPDATE OF role, status ON public.fund_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_fund_admin_permission_compatibility();

-- Existing admins retain today's full operational access when capability-aware
-- policies are enabled in the next phase.
INSERT INTO public.fund_admin_permissions (
  fund_id, user_id, permission_key, granted_by
)
SELECT
  membership.fund_id,
  membership.user_id,
  definition.permission_key,
  fund.owner_id
FROM public.fund_members AS membership
JOIN public.funds AS fund ON fund.id = membership.fund_id
CROSS JOIN public.fund_permission_definitions AS definition
WHERE membership.role = 'admin'::public.member_role
  AND membership.status = 'joined'::public.member_status
  AND membership.user_id IS NOT NULL
  AND fund.deleted_at IS NULL
  AND definition.is_active
ON CONFLICT (fund_id, user_id, permission_key) DO NOTHING;

REVOKE ALL ON FUNCTION public.has_fund_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_fund_permissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fund_admin_permissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.configure_fund_admin(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_fund_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_fund_admin_permission_compatibility() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_fund_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_fund_permissions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fund_admin_permissions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.configure_fund_admin(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_fund_admin(uuid) TO authenticated, service_role;
