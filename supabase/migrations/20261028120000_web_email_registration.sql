-- Allow a verified email-only user to complete web onboarding. Phone-based
-- signups retain their existing representation and uniqueness constraint.
BEGIN;
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  -- app_metadata is controlled by Supabase's administrative API; user
  -- metadata cannot authorize an email-only account. Existing phone signup
  -- behavior is unchanged.
  IF NULLIF(LTRIM(new.phone, '+'), '') IS NULL
     AND COALESCE(new.raw_app_meta_data ->> 'beta_web_approved', '') <> 'true'
     AND COALESCE(new.raw_app_meta_data ->> 'google_play_reviewer', '') <> 'true' THEN
    RAISE EXCEPTION 'Email registration is not enabled for this account';
  END IF;
  INSERT INTO public.users (id, phone, email, name)
  VALUES (new.id, NULLIF(LTRIM(new.phone, '+'), ''), new.email, '')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
COMMIT;
