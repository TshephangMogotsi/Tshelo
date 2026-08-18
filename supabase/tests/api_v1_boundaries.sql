-- Catalog-level integration checks for the API v1 migrations.
-- The disposable Supabase database applies every migration before this file.

BEGIN;

CREATE FUNCTION pg_temp.assert_true(condition boolean, failure_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'API v1 database assertion failed: %', failure_message;
  END IF;
END;
$$;

DO $$
DECLARE
  function_signature text;
BEGIN
  FOREACH function_signature IN ARRAY ARRAY[
    'public.create_standalone_event(text,text,date,text,text,text,time,date,time,text,text,jsonb)',
    'public.create_fund_for_existing_event(uuid,text,text,text,text,numeric,jsonb,date,boolean)',
    'public.platform_admin_update_support_ticket(uuid,jsonb)',
    'public.platform_admin_moderate_user(uuid,text,text)',
    'public.platform_admin_moderate_fund(uuid,text,text)',
    'public.platform_admin_upsert(uuid,text,text)'
  ]
  LOOP
    PERFORM pg_temp.assert_true(
      to_regprocedure(function_signature) IS NOT NULL,
      format('missing function %s', function_signature)
    );
    PERFORM pg_temp.assert_true(
      has_function_privilege('authenticated', function_signature, 'EXECUTE'),
      format('authenticated lacks execute on %s', function_signature)
    );
    PERFORM pg_temp.assert_true(
      NOT has_function_privilege('anon', function_signature, 'EXECUTE'),
      format('anon unexpectedly has execute on %s', function_signature)
    );
  END LOOP;
END;
$$;

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
      AND column_name = 'resolution_note'
      AND data_type = 'text'
  ),
  'support_tickets.resolution_note is missing'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
      AND column_name = 'resolved_by'
      AND data_type = 'uuid'
  ),
  'support_tickets.resolved_by is missing'
);

DO $$
DECLARE
  expected_policy text;
BEGIN
  FOREACH expected_policy IN ARRAY ARRAY[
    'platform_admin_read_fund_members',
    'platform_admin_read_event_organisers',
    'platform_admin_read_event_guests'
  ]
  LOOP
    PERFORM pg_temp.assert_true(
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'public'
          AND policyname = expected_policy
          AND cmd = 'SELECT'
          AND roles = ARRAY['authenticated']::name[]
      ),
      format('missing authenticated SELECT policy %s', expected_policy)
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  expected_index text;
BEGIN
  FOREACH expected_index IN ARRAY ARRAY[
    'api_users_created_page_idx',
    'api_funds_created_page_idx',
    'api_events_created_page_idx',
    'api_contributions_created_page_idx',
    'api_support_tickets_created_page_idx',
    'api_platform_admin_audit_created_page_idx',
    'api_fund_members_user_fund_idx',
    'api_event_organisers_user_event_idx',
    'api_event_guests_user_event_idx'
  ]
  LOOP
    PERFORM pg_temp.assert_true(
      to_regclass(format('public.%I', expected_index)) IS NOT NULL,
      format('missing index %s', expected_index)
    );
  END LOOP;
END;
$$;

ROLLBACK;
