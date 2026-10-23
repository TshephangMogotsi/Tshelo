-- Fresh databases must declare the access expected by the existing own-user
-- consent_log_select RLS policy; do not rely on automatic future-table grants.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'consent_log' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'consent_log must have row-level security enabled';
  END IF;
END;
$$;
GRANT SELECT ON public.consent_log TO authenticated;
