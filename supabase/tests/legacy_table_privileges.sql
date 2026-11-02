-- Run after all migrations. Catalog checks only; fixtures are rolled back.
-- No temporary assertion function is needed across role switches.
BEGIN;
SELECT public.assert_application_table_security();

-- Reproduce drift on a table explicitly recorded as legacy. The guard must
-- reject it rather than skip it because of its inventory entry.
CREATE TABLE public.legacy_acl_regression_probe(id integer);
ALTER TABLE public.legacy_acl_regression_probe ENABLE ROW LEVEL SECURITY;
INSERT INTO public.security_legacy_tables(table_oid)
VALUES ('public.legacy_acl_regression_probe'::regclass);
CREATE POLICY legacy_probe_read ON public.legacy_acl_regression_probe
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.legacy_acl_regression_probe TO authenticated;
SELECT public.assert_application_table_security();

DO $$
BEGIN
  GRANT DELETE ON public.legacy_acl_regression_probe TO authenticated;
  BEGIN
    PERFORM public.assert_application_table_security();
    RAISE EXCEPTION 'LEGACY_ACL_REGRESSION: unsupported delete was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Grant without matching RLS policy:%' THEN RAISE; END IF;
  END;
  REVOKE DELETE ON public.legacy_acl_regression_probe FROM authenticated;

  GRANT TRUNCATE ON public.legacy_acl_regression_probe TO authenticated;
  BEGIN
    PERFORM public.assert_application_table_security();
    RAISE EXCEPTION 'LEGACY_ACL_REGRESSION: truncate was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Unexpected structural grant%' THEN RAISE; END IF;
  END;
  REVOKE TRUNCATE ON public.legacy_acl_regression_probe FROM authenticated;

  GRANT SELECT ON public.legacy_acl_regression_probe TO anon;
  BEGIN
    PERFORM public.assert_application_table_security();
    RAISE EXCEPTION 'LEGACY_ACL_REGRESSION: anonymous read was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Unexpected anonymous table grant%' THEN RAISE; END IF;
  END;
  REVOKE SELECT ON public.legacy_acl_regression_probe FROM anon;
END $$;
SELECT public.assert_application_table_security();
ROLLBACK;
