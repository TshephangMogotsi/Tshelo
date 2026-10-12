-- Live review on 12 October found no SMS-log rows and no client consumers.
-- Keep structured processing records private; never retain future raw SMS
-- bodies or arbitrary error text (either can contain OTPs/account details).
REVOKE ALL ON public.sms_logs FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS sms_logs_select ON public.sms_logs;
DROP POLICY IF EXISTS sms_logs_insert ON public.sms_logs;
GRANT ALL ON public.sms_logs TO service_role;

CREATE OR REPLACE FUNCTION public.minimize_sms_log_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.raw_message := '[message content not retained]';
  IF NEW.parse_error IS NOT NULL THEN
    NEW.parse_error := '[processing error details not retained]';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.minimize_sms_log_content() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minimize_sms_log_content() TO service_role;

CREATE TRIGGER minimize_sms_log_content
BEFORE INSERT OR UPDATE ON public.sms_logs
FOR EACH ROW EXECUTE FUNCTION public.minimize_sms_log_content();

DO $$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_any_column_privilege(client_role, 'public.sms_logs', 'SELECT')
      OR has_any_column_privilege(client_role, 'public.sms_logs', 'INSERT')
      OR has_any_column_privilege(client_role, 'public.sms_logs', 'UPDATE')
      OR has_table_privilege(client_role, 'public.sms_logs', 'DELETE,TRUNCATE,REFERENCES,TRIGGER')
    THEN
      RAISE EXCEPTION 'SMS logs still accessible to %', client_role;
    END IF;
  END LOOP;
END;
$$;
