-- Platform-wide staff access for the Tshelo web admin console.
-- This is intentionally separate from fund-level administrator permissions.

CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('support', 'operations', 'finance', 'super_admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_admins IS
  'Invite-only allowlist for staff who may access the platform-wide web console.';

CREATE INDEX platform_admins_active_role_idx
  ON public.platform_admins (is_active, role);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(required_roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins AS admin
    WHERE admin.user_id = auth.uid()
      AND admin.is_active
      AND (required_roles IS NULL OR admin.role = ANY(required_roles))
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(text[]) TO authenticated, service_role;

CREATE POLICY platform_admins_select_authorized
  ON public.platform_admins
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT public.is_platform_admin(ARRAY['super_admin']))
  );

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;

-- Read access required by the first, deliberately read-only admin release.
CREATE POLICY platform_admin_read_users
  ON public.users FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_funds
  ON public.funds FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_events
  ON public.events FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_support_tickets
  ON public.support_tickets FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_disputes
  ON public.disputes FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_fraud_signals
  ON public.fraud_signals FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_contributions
  ON public.contributions FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_expenses
  ON public.expenses FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY platform_admin_read_audit_log
  ON public.audit_log FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE TABLE public.platform_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES public.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_admin_audit_log_created_idx
  ON public.platform_admin_audit_log (created_at DESC);
CREATE INDEX platform_admin_audit_log_actor_idx
  ON public.platform_admin_audit_log (actor_user_id, created_at DESC);

ALTER TABLE public.platform_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_admin_audit_select_authorized
  ON public.platform_admin_audit_log
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_platform_admin()));

GRANT SELECT ON public.platform_admin_audit_log TO authenticated;
GRANT ALL ON public.platform_admin_audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.record_platform_admin_action(
  action_name text,
  target_type text,
  target_id uuid DEFAULT NULL,
  action_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  audit_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform administrator access required';
  END IF;

  INSERT INTO public.platform_admin_audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    auth.uid(),
    action_name,
    target_type,
    target_id,
    COALESCE(action_metadata, '{}'::jsonb)
  )
  RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_platform_admin_action(text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_platform_admin_action(text, text, uuid, jsonb)
  TO authenticated, service_role;
