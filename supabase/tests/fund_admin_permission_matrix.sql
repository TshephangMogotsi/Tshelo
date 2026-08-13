-- Transactional integration tests for granular fund administration.
-- Run against a migrated disposable database with:
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/fund_admin_permission_matrix.sql
-- Every fixture and temporary definition is rolled back at the end.

BEGIN;

CREATE FUNCTION pg_temp.set_test_user(test_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', test_user_id, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE FUNCTION pg_temp.assert_true(condition boolean, failure_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'permission matrix assertion failed: %', failure_message;
  END IF;
END;
$$;

CREATE TEMP TABLE permission_test_ids (
  owner_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  member_id uuid NOT NULL,
  fund_id uuid NOT NULL,
  event_id uuid NOT NULL,
  admin_membership_id uuid,
  member_membership_id uuid
);

INSERT INTO permission_test_ids (owner_id, admin_id, member_id, fund_id, event_id)
VALUES (
  'f1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000003',
  'f2000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001'
);

INSERT INTO public.users (id, phone, name, preferred_currency)
SELECT owner_id, '+26771000001', 'Permission Test Owner', 'BWP' FROM permission_test_ids
UNION ALL
SELECT admin_id, '+26771000002', 'Permission Test Admin', 'BWP' FROM permission_test_ids
UNION ALL
SELECT member_id, '+26771000003', 'Permission Test Member', 'BWP' FROM permission_test_ids;

SELECT pg_temp.set_test_user(owner_id) FROM permission_test_ids;

INSERT INTO public.funds (
  id, owner_id, fund_code, share_code, title, fund_type,
  currency_code, goal_amount, status
)
SELECT
  fund_id, owner_id, 'PMATRIX1', 'PMATRIX-SHARE', 'Permission Matrix Fund',
  'other', 'BWP', 10000, 'active'
FROM permission_test_ids;

INSERT INTO public.fund_members (
  fund_id, user_id, role, status, invited_by, joined_at
)
SELECT fund_id, admin_id, 'admin', 'joined', owner_id, now()
FROM permission_test_ids
RETURNING id;

INSERT INTO public.fund_members (
  fund_id, user_id, role, status, invited_by, joined_at
)
SELECT fund_id, member_id, 'member', 'joined', owner_id, now()
FROM permission_test_ids
RETURNING id;

UPDATE permission_test_ids AS ids
SET admin_membership_id = membership.id
FROM public.fund_members AS membership
WHERE membership.fund_id = ids.fund_id
  AND membership.user_id = ids.admin_id;

UPDATE permission_test_ids AS ids
SET member_membership_id = membership.id
FROM public.fund_members AS membership
WHERE membership.fund_id = ids.fund_id
  AND membership.user_id = ids.member_id;

INSERT INTO public.events (
  id, creator_id, event_code, share_code, name, event_type,
  event_date, currency_code, linked_fund_id, status
)
SELECT
  event_id, owner_id, 'EVTPMATRIX', 'EVT-PMATRIX', 'Permission Matrix Event',
  'other', current_date + 30, 'BWP', fund_id, 'active'
FROM permission_test_ids;

-- Owner: all active capabilities are implicit, even without grant rows.
DO $$
DECLARE
  ids permission_test_ids%ROWTYPE;
  active_count integer;
  effective_count integer;
BEGIN
  SELECT * INTO ids FROM permission_test_ids;
  PERFORM pg_temp.set_test_user(ids.owner_id);
  SELECT count(*) INTO active_count
  FROM public.fund_permission_definitions WHERE is_active;
  SELECT count(*) INTO effective_count
  FROM public.get_my_fund_permissions(ids.fund_id);
  PERFORM pg_temp.assert_true(
    effective_count = active_count,
    'owner should receive the complete active catalogue'
  );
END;
$$;

-- Ordinary member: relationship access never implies an operational grant.
DO $$
DECLARE
  ids permission_test_ids%ROWTYPE;
BEGIN
  SELECT * INTO ids FROM permission_test_ids;
  PERFORM pg_temp.set_test_user(ids.member_id);
  PERFORM pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM public.get_my_fund_permissions(ids.fund_id)),
    'ordinary member should receive no operational capability'
  );
END;
$$;

-- Admin: every permission is isolated. Granting one must expose exactly one.
DO $$
DECLARE
  ids permission_test_ids%ROWTYPE;
  capability record;
  effective_permissions text[];
BEGIN
  SELECT * INTO ids FROM permission_test_ids;
  FOR capability IN
    SELECT permission_key
    FROM public.fund_permission_definitions
    WHERE is_active
    ORDER BY sort_order
  LOOP
    DELETE FROM public.fund_admin_permissions
    WHERE fund_id = ids.fund_id AND user_id = ids.admin_id;
    INSERT INTO public.fund_admin_permissions (
      fund_id, user_id, permission_key, granted_by
    ) VALUES (
      ids.fund_id, ids.admin_id, capability.permission_key, ids.owner_id
    );

    PERFORM pg_temp.set_test_user(ids.admin_id);
    SELECT array_agg(permission_key ORDER BY permission_key)
    INTO effective_permissions
    FROM public.get_my_fund_permissions(ids.fund_id);

    PERFORM pg_temp.assert_true(
      effective_permissions = ARRAY[capability.permission_key],
      format('%s should not imply another capability', capability.permission_key)
    );
    PERFORM pg_temp.assert_true(
      public.has_fund_permission(ids.fund_id, capability.permission_key),
      format('%s should be effective for the admin', capability.permission_key)
    );
  END LOOP;
END;
$$;

-- Member-directory reads: joined rows remain visible to the fund, while a
-- pending request requires manage_members (or ownership/inviter access).
DO $$
DECLARE
  ids permission_test_ids%ROWTYPE;
  pending_user_id uuid := 'f1000000-0000-4000-8000-000000000004';
BEGIN
  SELECT * INTO ids FROM permission_test_ids;
  INSERT INTO public.users (id, phone, name, preferred_currency)
  VALUES (pending_user_id, '+26771000004', 'Permission Test Pending', 'BWP');

  PERFORM pg_temp.set_test_user(ids.owner_id);
  INSERT INTO public.fund_members (
    fund_id, user_id, role, status, invited_by
  ) VALUES (
    ids.fund_id, pending_user_id, 'member', 'pending', ids.owner_id
  );

  PERFORM pg_temp.set_test_user(ids.member_id);
  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1 FROM public.get_fund_member_profiles(ids.fund_id)
      WHERE user_id = ids.admin_id
    ),
    'joined member should see the joined fund directory'
  );
  PERFORM pg_temp.assert_true(
    NOT EXISTS (
      SELECT 1 FROM public.get_fund_member_profiles(ids.fund_id)
      WHERE user_id = pending_user_id
    ),
    'ordinary joined member must not see a pending request profile'
  );

  PERFORM pg_temp.set_test_user(ids.owner_id);
  INSERT INTO public.fund_admin_permissions (
    fund_id, user_id, permission_key, granted_by
  ) VALUES (
    ids.fund_id, ids.admin_id, 'manage_members', ids.owner_id
  ) ON CONFLICT (fund_id, user_id, permission_key) DO NOTHING;
  PERFORM pg_temp.set_test_user(ids.admin_id);
  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1 FROM public.get_fund_member_profiles(ids.fund_id)
      WHERE user_id = pending_user_id
    ),
    'manage_members admin should see pending request profiles'
  );
END;
$$;

-- Status, role, catalogue activation, soft deletion, and linked-event mapping.
DO $$
DECLARE
  ids permission_test_ids%ROWTYPE;
BEGIN
  SELECT * INTO ids FROM permission_test_ids;
  DELETE FROM public.fund_admin_permissions
  WHERE fund_id = ids.fund_id AND user_id = ids.admin_id;
  INSERT INTO public.fund_admin_permissions (
    fund_id, user_id, permission_key, granted_by
  ) VALUES
    (ids.fund_id, ids.admin_id, 'manage_event_guests', ids.owner_id);

  PERFORM pg_temp.set_test_user(ids.admin_id);
  PERFORM pg_temp.assert_true(
    public.has_linked_event_fund_permission(ids.event_id, 'manage_event_guests'),
    'linked event should inherit the matching fund capability'
  );
  PERFORM pg_temp.assert_true(
    NOT public.has_linked_event_fund_permission(ids.event_id, 'manage_event_budget'),
    'linked event capability must not imply budget access'
  );
  PERFORM pg_temp.assert_true(
    NOT public.has_fund_permission(ids.fund_id, 'not_a_permission'),
    'unknown permission must fail closed'
  );

  UPDATE public.fund_members SET status = 'left'
  WHERE id = ids.admin_membership_id;
  PERFORM pg_temp.assert_true(
    NOT public.has_fund_permission(ids.fund_id, 'manage_event_guests'),
    'inactive admin membership must revoke effective access'
  );

  PERFORM pg_temp.set_test_user(ids.owner_id);
  UPDATE public.fund_members SET status = 'joined', role = 'admin'
  WHERE id = ids.admin_membership_id;
  DELETE FROM public.fund_admin_permissions
  WHERE fund_id = ids.fund_id AND user_id = ids.admin_id;
  INSERT INTO public.fund_admin_permissions (
    fund_id, user_id, permission_key, granted_by
  ) VALUES
    (ids.fund_id, ids.admin_id, 'manage_event_guests', ids.owner_id);

  UPDATE public.fund_permission_definitions SET is_active = false
  WHERE permission_key = 'manage_event_guests';
  PERFORM pg_temp.set_test_user(ids.admin_id);
  PERFORM pg_temp.assert_true(
    NOT public.has_fund_permission(ids.fund_id, 'manage_event_guests'),
    'inactive catalogue definition must revoke the grant'
  );
  UPDATE public.fund_permission_definitions SET is_active = true
  WHERE permission_key = 'manage_event_guests';

  UPDATE public.funds SET deleted_at = now() WHERE id = ids.fund_id;
  PERFORM pg_temp.assert_true(
    NOT public.has_fund_permission(ids.fund_id, 'manage_event_guests'),
    'soft-deleted fund must revoke every effective grant'
  );
  UPDATE public.funds SET deleted_at = NULL WHERE id = ids.fund_id;
END;
$$;

-- Owner RPCs: promotion is atomic, auditable, and non-owner calls are rejected.
DO $$
DECLARE
  ids permission_test_ids%ROWTYPE;
  configured text[];
  rejected boolean := false;
BEGIN
  SELECT * INTO ids FROM permission_test_ids;
  PERFORM pg_temp.set_test_user(ids.owner_id);
  UPDATE public.fund_members SET role = 'member'
  WHERE id = ids.admin_membership_id;

  SELECT array_agg(permission_key ORDER BY permission_key)
  INTO configured
  FROM public.configure_fund_admin(
    ids.admin_membership_id,
    ARRAY['record_contributions', 'export_reports']
  );
  PERFORM pg_temp.assert_true(
    configured = ARRAY['export_reports', 'record_contributions'],
    'configure RPC should return exactly the requested grants'
  );
  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1 FROM public.audit_log
      WHERE fund_id = ids.fund_id
        AND entity_id = ids.admin_membership_id
        AND action = 'permissions_changed'
    ),
    'configure RPC should append an audit event'
  );

  PERFORM pg_temp.set_test_user(ids.member_id);
  BEGIN
    PERFORM public.configure_fund_admin(
      ids.admin_membership_id,
      ARRAY['record_expenses']
    );
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM LIKE 'Only the fund owner%';
  END;
  PERFORM pg_temp.assert_true(rejected, 'non-owner must not configure admins');

  PERFORM pg_temp.set_test_user(ids.owner_id);
  PERFORM public.remove_fund_admin(ids.admin_membership_id);
  PERFORM pg_temp.assert_true(
    (SELECT role = 'member'::public.member_role
     FROM public.fund_members WHERE id = ids.admin_membership_id),
    'remove RPC should demote the admin to ordinary member'
  );
  PERFORM pg_temp.assert_true(
    NOT EXISTS (
      SELECT 1 FROM public.fund_admin_permissions
      WHERE fund_id = ids.fund_id AND user_id = ids.admin_id
    ),
    'remove RPC should clear every dormant grant'
  );
END;
$$;

ROLLBACK;
