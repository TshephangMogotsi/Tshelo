-- Approved policy: 12 calendar months, or sooner when the purpose is fulfilled.
ALTER TABLE public.country_waitlist ALTER COLUMN expires_at SET DEFAULT (now()+interval '12 months');

CREATE OR REPLACE FUNCTION public.submit_country_waitlist(p_country text, p_email text DEFAULT NULL, p_phone text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public, pg_temp AS $$
DECLARE c text := upper(btrim(p_country)); e text := nullif(lower(btrim(p_email)),'');
  p text := nullif(btrim(p_phone),''); country public.countries%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'WAITLIST_FORBIDDEN'; END IF;
  SELECT * INTO country FROM public.countries WHERE code=c AND is_launch_country IS NOT TRUE;
  IF country.code IS NULL OR (e IS NULL AND p IS NULL)
    OR (e IS NOT NULL AND (length(e)>254 OR e !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
    OR (p IS NOT NULL AND (p !~ '^\+[1-9][0-9]{6,14}$'
      OR left(p,length(country.phone_prefix))<>country.phone_prefix
      OR length(p)<>length(country.phone_prefix)+country.phone_length))
  THEN RAISE EXCEPTION 'WAITLIST_INVALID'; END IF;
  INSERT INTO public.country_waitlist(country_code,email,phone,expires_at)
    VALUES(c,e,p,now()+interval '12 months') ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.purge_expired_country_waitlist()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public, pg_temp AS $$
BEGIN
  DELETE FROM public.country_waitlist WHERE expires_at<=now() OR notified IS TRUE OR signed_up IS TRUE;
  DELETE FROM public.country_waitlist_rate_limits WHERE expires_at<=now();
END; $$;
REVOKE ALL ON FUNCTION public.submit_country_waitlist(text,text,text),public.purge_expired_country_waitlist() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_country_waitlist(text,text,text),public.purge_expired_country_waitlist() TO service_role;

-- Read-only inspection confirmed no prior cron.job table in the linked project.
-- This creates only the cleanup job; it does not schedule notification reminders.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('tshelo-country-waitlist-cleanup','15 2 * * *',
  'SELECT public.purge_expired_country_waitlist();');
SELECT public.assert_application_table_security();
