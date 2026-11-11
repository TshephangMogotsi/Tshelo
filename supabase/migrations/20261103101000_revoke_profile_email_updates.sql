-- Phase 2: deploy the API compatibility change first. Older clients include
-- the unchanged email in profile saves; the new API strips that field before
-- updating other fields. Phase 1 already blocks unverified email changes.
BEGIN;
REVOKE UPDATE (email) ON public.users FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF has_column_privilege('authenticated','public.users','email','UPDATE')
    OR has_column_privilege('anon','public.users','email','UPDATE') THEN
    RAISE EXCEPTION 'PROFILE_EMAIL_UPDATE_STILL_GRANTED';
  END IF;
END $$;

SELECT public.assert_application_table_security();
NOTIFY pgrst, 'reload schema';
COMMIT;
