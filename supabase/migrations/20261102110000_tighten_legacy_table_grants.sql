-- Tighten existing table ACLs without granting any new application capability.
-- RLS remains mandatory. Preserve existing caller operations only when a
-- permissive policy supports them; keep column-restricted grants restricted.
BEGIN;
CREATE TEMP TABLE legacy_grants_to_keep (
  table_name name, role_name name, privilege text, column_name name
) ON COMMIT DROP;

DO $$
DECLARE t record; actor text; operation text; column_record record;
  supported boolean; table_allowed boolean;
BEGIN
  FOR t IN
    SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN public.security_legacy_tables legacy ON legacy.table_oid=c.oid
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname
  LOOP
    IF NOT t.relrowsecurity THEN RAISE EXCEPTION 'RLS missing on public.%',t.relname; END IF;
    FOREACH actor IN ARRAY ARRAY['authenticated','service_role'] LOOP
      FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        supported := actor='service_role';
        IF actor='authenticated' AND operation IN ('SELECT','INSERT','UPDATE','DELETE') THEN
          SELECT EXISTS (
            SELECT 1 FROM pg_policy p WHERE p.polrelid=t.oid AND p.polpermissive
              AND (p.polcmd='*' OR p.polcmd=CASE operation
                WHEN 'SELECT' THEN 'r' WHEN 'INSERT' THEN 'a' WHEN 'UPDATE' THEN 'w' ELSE 'd' END::"char")
              AND (0=ANY(p.polroles) OR 'authenticated'::regrole::oid=ANY(p.polroles))
              AND coalesce(pg_get_expr(CASE WHEN operation='INSERT'
                THEN coalesce(p.polwithcheck,p.polqual) ELSE p.polqual END,p.polrelid),'true') <> 'false'
          ) INTO supported;
        END IF;
        IF NOT supported THEN CONTINUE; END IF;
        table_allowed := has_table_privilege(actor,t.oid,operation);
        IF table_allowed THEN
          INSERT INTO pg_temp.legacy_grants_to_keep VALUES(t.relname,actor,operation,NULL);
        ELSIF operation IN ('SELECT','INSERT','UPDATE','REFERENCES') THEN
          FOR column_record IN SELECT attname,attnum FROM pg_attribute
            WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped LOOP
            IF has_column_privilege(actor,t.oid,column_record.attnum,operation) THEN
              INSERT INTO pg_temp.legacy_grants_to_keep VALUES(t.relname,actor,operation,column_record.attname);
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
    -- The signed-out waitlist selects code/name and filters is_launch_country.
    -- Preserve these only if they were already readable before this migration.
    IF t.relname='countries' THEN
      FOR column_record IN SELECT attname,attnum FROM pg_attribute
        WHERE attrelid=t.oid AND attname IN ('code','name','is_launch_country') AND NOT attisdropped LOOP
        IF has_column_privilege('anon',t.oid,column_record.attnum,'SELECT') THEN
          INSERT INTO pg_temp.legacy_grants_to_keep VALUES(t.relname,'anon','SELECT',column_record.attname);
        END IF;
      END LOOP;
    END IF;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t.relname);
    -- Table-level REVOKE does not remove separate column ACLs.
    FOR column_record IN SELECT attname FROM pg_attribute
      WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',column_record.attname,t.relname);
    END LOOP;
  END LOOP;
END $$;

DO $$ DECLARE g record; BEGIN
  FOR g IN SELECT * FROM pg_temp.legacy_grants_to_keep LOOP
    IF g.column_name IS NULL THEN
      EXECUTE format('GRANT %s ON TABLE public.%I TO %I',g.privilege,g.table_name,g.role_name);
    ELSE
      EXECUTE format('GRANT %s (%I) ON TABLE public.%I TO %I',g.privilege,g.column_name,g.table_name,g.role_name);
    END IF;
  END LOOP;
END $$;

-- Older tables now meet the same checks as newer tables. Keep the historical
-- security_legacy_tables inventory, but do not exempt its entries from checks.
CREATE OR REPLACE FUNCTION public.assert_application_table_security()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE t record; actor text; operation text; column_record record;
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
    IF has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Unexpected anonymous table grant on public.%',t.relname;
    END IF;
    FOR column_record IN SELECT attname,attnum FROM pg_attribute
      WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped LOOP
      IF has_column_privilege('anon',t.oid,column_record.attnum,'INSERT,UPDATE,REFERENCES')
        OR (has_column_privilege('anon',t.oid,column_record.attnum,'SELECT')
          AND NOT (t.relname='countries' AND column_record.attname IN ('code','name','is_launch_country'))) THEN
        RAISE EXCEPTION 'Unexpected anonymous column grant on public.%.%',t.relname,column_record.attname;
      END IF;
    END LOOP;
    FOREACH actor IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(actor,t.oid,'TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(actor,t.oid,'REFERENCES') THEN
        RAISE EXCEPTION 'Unexpected structural grant on % to %',t.relname,actor;
      END IF;
      FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
        IF has_table_privilege(actor,t.oid,operation)
          OR (operation <> 'DELETE' AND has_any_column_privilege(actor,t.oid,operation)) THEN
          IF NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=t.oid AND p.polpermissive
            AND (p.polcmd='*' OR p.polcmd=CASE operation
              WHEN 'SELECT' THEN 'r' WHEN 'INSERT' THEN 'a' WHEN 'UPDATE' THEN 'w' ELSE 'd' END::"char")
            AND (0=ANY(p.polroles) OR actor::regrole::oid=ANY(p.polroles))
            AND coalesce(pg_get_expr(CASE WHEN operation='INSERT'
              THEN coalesce(p.polwithcheck,p.polqual) ELSE p.polqual END,p.polrelid),'true') <> 'false') THEN
            RAISE EXCEPTION 'Grant without matching RLS policy: %.% to %',t.relname,operation,actor;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.assert_application_table_security() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_application_table_security() TO service_role;
SELECT public.assert_application_table_security();
COMMIT;
