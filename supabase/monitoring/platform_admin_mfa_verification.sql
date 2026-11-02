-- Operator verification of current production MFA authorization.
-- Uses synthetic JWT claims under the authenticated database role. This does
-- not prove real Auth sign-in, factor enrolment, signature validation or recovery.
-- All checks run in a rollback-only transaction; no account or role is created.
BEGIN;
SET LOCAL statement_timeout = '30s';

DO $verify$
DECLARE subject record; level text; call_sql text; allowed boolean; n integer:=0;
BEGIN
  FOR subject IN SELECT user_id,role FROM public.platform_admins WHERE is_active LOOP
    n:=n+1;
    FOREACH level IN ARRAY ARRAY[NULL::text,'aal1','invalid','aal2'] LOOP
      PERFORM set_config('request.jwt.claim.sub',subject.user_id::text,true);
      PERFORM set_config('request.jwt.claim.role','authenticated',true);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',subject.user_id,'role','authenticated','aal',level)::text,true);
      SET LOCAL ROLE authenticated;
      SELECT public.is_platform_admin() INTO allowed;
      IF allowed IS DISTINCT FROM (level IS NOT DISTINCT FROM 'aal2') THEN RAISE EXCEPTION 'Unexpected platform assurance decision'; END IF;
      IF (SELECT count(*) FROM public.platform_admins WHERE user_id=auth.uid() AND is_active)<>1 THEN RAISE EXCEPTION 'Enrollment self-role lookup blocked'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid()) THEN RAISE EXCEPTION 'Own-profile read blocked'; END IF;
      IF level IS DISTINCT FROM 'aal2' THEN
        IF EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id<>auth.uid()) THEN RAISE EXCEPTION 'Cross-admin role lookup leaked at insufficient assurance'; END IF;
        FOREACH call_sql IN ARRAY ARRAY[
          'SELECT public.platform_admin_moderate_user(''00000000-0000-4000-8000-000000000000''::uuid,''flag'',''MFA rollout verification'')',
          'SELECT public.platform_admin_update_support_ticket(''00000000-0000-4000-8000-000000000000''::uuid,''{}''::jsonb)',
          'SELECT public.platform_admin_moderate_fund(''00000000-0000-4000-8000-000000000000''::uuid,''close'',''MFA rollout verification'')',
          'SELECT public.platform_admin_upsert(''00000000-0000-4000-8000-000000000000''::uuid,''support'',''active'')'
        ] LOOP
          BEGIN
            EXECUTE call_sql;
            RAISE EXCEPTION 'Privileged RPC accepted insufficient assurance';
          EXCEPTION WHEN insufficient_privilege THEN
            IF SQLERRM<>'Multi-factor verification required' THEN RAISE EXCEPTION 'Unexpected privileged RPC denial: %',SQLERRM; END IF;
          END;
        END LOOP;
      END IF;
      RESET ROLE;
    END LOOP;
  END LOOP;
  IF n<2 THEN RAISE EXCEPTION 'Expected administrator subjects are missing'; END IF;
  IF has_function_privilege('authenticated','public.require_platform_admin_operation(text)','EXECUTE') THEN RAISE EXCEPTION 'Internal helper is publicly executable'; END IF;
END;
$verify$;
ROLLBACK;
SELECT 'platform_admin_mfa_authorization_checks_passed' AS result;
