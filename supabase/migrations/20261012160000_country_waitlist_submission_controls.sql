REVOKE ALL ON public.country_waitlist FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS country_waitlist_insert ON public.country_waitlist;
DROP POLICY IF EXISTS country_waitlist_select ON public.country_waitlist;
GRANT ALL ON public.country_waitlist TO service_role;

CREATE UNIQUE INDEX country_waitlist_country_email ON public.country_waitlist(country_code, lower(btrim(email))) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX country_waitlist_country_phone ON public.country_waitlist(country_code, phone) WHERE phone IS NOT NULL;
ALTER TABLE public.country_waitlist ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now() + interval '365 days');

CREATE TABLE public.country_waitlist_rate_limits (
  key text PRIMARY KEY, window_started_at timestamptz NOT NULL, attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.country_waitlist_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.country_waitlist_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.country_waitlist_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_country_waitlist_limits(p_ip_key text, p_contact_keys text[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public, pg_temp AS $$
DECLARE k text; duration interval; max_attempts integer; used integer; allowed boolean := true;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'WAITLIST_FORBIDDEN'; END IF;
  IF p_ip_key IS NULL OR p_ip_key !~ '^[a-f0-9]{64}$' OR cardinality(p_contact_keys) NOT BETWEEN 1 AND 2
    OR p_contact_keys IS NULL OR EXISTS (SELECT 1 FROM unnest(p_contact_keys) x WHERE x IS NULL OR x !~ '^[a-f0-9]{64}$')
  THEN RAISE EXCEPTION 'WAITLIST_INVALID'; END IF;
  -- Sorted advisory locks serialize concurrent workers and avoid deadlocks.
  FOR k IN SELECT DISTINCT x FROM unnest(array_prepend('ip:'||p_ip_key,
    ARRAY(SELECT 'contact:'||x FROM unnest(p_contact_keys) x))) x ORDER BY x LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
    duration := CASE WHEN k LIKE 'ip:%' THEN interval '1 hour' ELSE interval '1 day' END;
    max_attempts := CASE WHEN k LIKE 'ip:%' THEN 10 ELSE 3 END;
    INSERT INTO public.country_waitlist_rate_limits AS r (key,window_started_at,attempts,expires_at)
    VALUES(k,now(),1,now()+duration)
    ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN r.expires_at<=now() THEN 1 ELSE least(r.attempts+1,1000000) END,
      window_started_at=CASE WHEN r.expires_at<=now() THEN now() ELSE r.window_started_at END,
      expires_at=CASE WHEN r.expires_at<=now() THEN now()+duration ELSE r.expires_at END
    RETURNING attempts INTO used;
    IF used>max_attempts THEN allowed := false; END IF;
  END LOOP;
  RETURN allowed;
END; $$;

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
  -- No identity/record ID or duplicate status is exposed to the submitter.
  INSERT INTO public.country_waitlist(country_code,email,phone,expires_at)
    VALUES(c,e,p,now()+interval '365 days') ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.purge_expired_country_waitlist()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public, pg_temp AS $$
BEGIN
  DELETE FROM public.country_waitlist WHERE expires_at<=now();
  DELETE FROM public.country_waitlist_rate_limits WHERE expires_at<=now();
END; $$;
REVOKE ALL ON FUNCTION public.consume_country_waitlist_limits(text,text[]), public.submit_country_waitlist(text,text,text), public.purge_expired_country_waitlist() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_country_waitlist_limits(text,text[]), public.submit_country_waitlist(text,text,text), public.purge_expired_country_waitlist() TO service_role;
-- pg_cron is not enabled in the linked project. Wire this purge to a scheduler
-- before public collection starts; do not enable unrelated scheduled reminders.
SELECT public.assert_application_table_security();
