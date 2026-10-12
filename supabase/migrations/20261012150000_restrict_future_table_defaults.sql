-- Application migrations execute as postgres. Revoke both global and per-schema
-- grants: schema-level REVOKE cannot cancel a global default grant.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

-- Managed-role defaults require membership; never silently claim they changed.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN
    IF pg_has_role(current_user, 'supabase_admin', 'MEMBER') THEN
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
    ELSE
      RAISE NOTICE 'supabase_admin table defaults require a managed-role administrator; application migrations must create tables as postgres';
    END IF;
  END IF;
END; $$;

-- Remember the legacy tables; existing grants are outside this future-table
-- change. The guard always checks RLS on all application tables.
CREATE TABLE public.security_legacy_tables (table_oid oid PRIMARY KEY);
ALTER TABLE public.security_legacy_tables ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_legacy_tables FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.security_legacy_tables TO service_role;
INSERT INTO public.security_legacy_tables
SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p');

CREATE OR REPLACE FUNCTION public.assert_application_table_security()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE t record; client_role text; privilege text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_default_acl d
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
    WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='r'
      AND (d.defaclnamespace=0 OR n.nspname='public')
      AND (a.grantee=0 OR a.grantee IN ('anon'::regrole,'authenticated'::regrole))) THEN
    RAISE EXCEPTION 'Unexpected client default table grants for postgres';
  END IF;
  FOR t IN SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
    IF NOT t.relrowsecurity THEN RAISE EXCEPTION 'RLS missing on public.%',t.relname; END IF;
    IF EXISTS (SELECT 1 FROM public.security_legacy_tables WHERE table_oid=t.oid) THEN CONTINUE; END IF;
    FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(client_role,t.oid,'TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(client_role,t.oid,'REFERENCES') THEN
        RAISE EXCEPTION 'Unexpected structural grant on % to %',t.relname,client_role;
      END IF;
      FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
        IF has_table_privilege(client_role,t.oid,privilege)
          OR (privilege <> 'DELETE' AND has_any_column_privilege(client_role,t.oid,privilege)) THEN
          IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t.relname
            AND p.cmd IN (privilege,'ALL') AND (client_role::name=ANY(p.roles) OR 'public'::name=ANY(p.roles))) THEN
            RAISE EXCEPTION 'Grant without matching RLS policy: %.% to %',t.relname,privilege,client_role;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.assert_application_table_security() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_application_table_security() TO service_role;
SELECT public.assert_application_table_security();
