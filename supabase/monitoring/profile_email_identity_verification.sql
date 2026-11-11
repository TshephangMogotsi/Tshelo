-- Safe for production: catalog metadata and guard execution only, no user rows.
BEGIN READ ONLY;
DO $$ BEGIN
  IF has_column_privilege('authenticated','public.users','email','UPDATE')
    OR has_column_privilege('anon','public.users','email','UPDATE') THEN
    RAISE EXCEPTION 'Profile email remains client-writable';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
    AND tgname='on_auth_email_changed' AND tgenabled IN ('O','A'))
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.users'::regclass
    AND tgname='enforce_verified_profile_email' AND tgenabled IN ('O','A'))
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.account_closure_verifications'::regclass
    AND tgname='bind_verified_closure_account' AND tgenabled IN ('O','A')) THEN
    RAISE EXCEPTION 'Profile email or account binding trigger missing/disabled';
  END IF;
  IF has_function_privilege('authenticated','public.resolve_verified_closure_account(text)','EXECUTE')
    OR has_function_privilege('anon','public.resolve_verified_closure_account(text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.resolve_verified_closure_account(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.consume_verified_account_closure_request(text)','EXECUTE')
    OR has_function_privilege('anon','public.consume_verified_account_closure_request(text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.consume_verified_account_closure_request(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Deletion identity resolver/consumer role boundary invalid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a
    ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
    WHERE c.conrelid='public.account_closure_verifications'::regclass
      AND c.confrelid='public.users'::regclass AND c.contype='f' AND a.attname='account_user_id') THEN
    RAISE EXCEPTION 'Deletion token account binding foreign key missing';
  END IF;
END $$;
SELECT public.assert_application_table_security();
SELECT 'PASS' AS profile_email_identity, clock_timestamp() AS verified_at,
  has_column_privilege('authenticated','public.users','email','UPDATE') AS authenticated_email_update,
  has_column_privilege('anon','public.users','email','UPDATE') AS anonymous_email_update,
  (SELECT jsonb_object_agg(proname,md5(prosrc)) FROM pg_proc WHERE oid IN (
    'public.sync_verified_auth_email()'::regprocedure,
    'public.enforce_verified_profile_email()'::regprocedure,
    'public.resolve_verified_closure_account(text)'::regprocedure,
    'public.bind_verified_closure_account()'::regprocedure,
    'public.consume_verified_account_closure_request(text)'::regprocedure)) AS function_body_md5;
COMMIT;
