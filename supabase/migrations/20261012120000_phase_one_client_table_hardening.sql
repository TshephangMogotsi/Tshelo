-- Phase 1: server-owned verification/logging and private operational data.
-- No current mobile/web caller creates verification or SMS-log rows, reads
-- promo codes, or reads template/config tables. Do not add a client RPC until
-- the corresponding provider-backed flow has validation and abuse controls.

REVOKE ALL ON TABLE public.mobile_money_verifications, public.sms_logs,
  public.promo_codes, public.app_config, public.notification_templates
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mobile_money_verifications, public.sms_logs,
  public.promo_codes, public.app_config, public.notification_templates
  TO service_role;

-- Preserve existing read-only access to the member's own records.
GRANT SELECT ON public.mobile_money_verifications, public.sms_logs TO authenticated;
DROP POLICY IF EXISTS mmv_insert ON public.mobile_money_verifications;
DROP POLICY IF EXISTS mmv_select ON public.mobile_money_verifications;
CREATE POLICY mmv_select ON public.mobile_money_verifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS sms_logs_insert ON public.sms_logs;
DROP POLICY IF EXISTS sms_logs_select ON public.sms_logs;
CREATE POLICY sms_logs_select ON public.sms_logs FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- Promo validation/redemption is not implemented. No catalog enumeration.
DROP POLICY IF EXISTS promo_codes_select ON public.promo_codes;
-- Templates are rendered by trusted senders; clients receive notifications.
DROP POLICY IF EXISTS notification_templates_select ON public.notification_templates;

-- Only version and maintenance settings are safe for authenticated clients.
-- New keys are private by default; descriptions/updated_by are not exposed.
DROP POLICY IF EXISTS app_config_select ON public.app_config;
CREATE POLICY app_config_select ON public.app_config FOR SELECT TO authenticated
  USING (key IN ('app_version_minimum', 'app_version_latest',
    'maintenance_mode', 'maintenance_message'));
GRANT SELECT (key, value) ON public.app_config TO authenticated;

-- Fail deployment on effective/inherited grants that bypass this boundary.
DO $$
DECLARE
  client_role text;
  target_table text;
  forbidden_privilege text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH target_table IN ARRAY ARRAY['mobile_money_verifications', 'sms_logs',
      'promo_codes', 'app_config', 'notification_templates'] LOOP
      FOREACH forbidden_privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE',
        'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(client_role, 'public.' || target_table, forbidden_privilege)
          OR (forbidden_privilege IN ('INSERT', 'UPDATE', 'REFERENCES')
            AND has_any_column_privilege(client_role, 'public.' || target_table, forbidden_privilege))
        THEN
          RAISE EXCEPTION 'Phase 1: % still has % on %', client_role, forbidden_privilege, target_table;
        END IF;
      END LOOP;
      IF (client_role = 'anon' OR target_table IN ('promo_codes', 'notification_templates'))
        AND has_any_column_privilege(client_role, 'public.' || target_table, 'SELECT')
      THEN
        RAISE EXCEPTION 'Phase 1: % still has read access to %', client_role, target_table;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
