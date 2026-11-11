-- Production-safe catalog checks: no fixtures, application rows or mutations.
-- Fails against blanket grants even if the old legacy-exempt guard is present.
BEGIN READ ONLY;
SELECT public.assert_application_table_security();
DO $$
DECLARE t record; a record; actor text;
BEGIN
  FOR t IN SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
    IF NOT t.relrowsecurity THEN RAISE EXCEPTION 'RLS missing on %',t.relname; END IF;
    IF has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Anonymous table access remains on %',t.relname;
    END IF;
    FOREACH actor IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(actor,t.oid,'TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(actor,t.oid,'REFERENCES') THEN
        RAISE EXCEPTION 'Structural privilege remains on % for %',t.relname,actor;
      END IF;
    END LOOP;
    FOR a IN SELECT attnum,attname FROM pg_attribute
      WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped LOOP
      IF has_column_privilege('anon',t.oid,a.attnum,'INSERT,UPDATE,REFERENCES')
        OR (has_column_privilege('anon',t.oid,a.attnum,'SELECT') AND NOT
          (t.relname='countries' AND a.attname IN ('code','name','is_launch_country'))) THEN
        RAISE EXCEPTION 'Unexpected anonymous column access on %.%',t.relname,a.attname;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT has_column_privilege('anon','public.countries','code','SELECT')
    OR NOT has_column_privilege('anon','public.countries','name','SELECT')
    OR NOT has_column_privilege('anon','public.countries','is_launch_country','SELECT') THEN
    RAISE EXCEPTION 'Public waitlist country read permissions missing';
  END IF;
END $$;
SELECT 'PASS' AS legacy_table_grants, clock_timestamp() AS verified_at,
  current_database() AS database,
  (SELECT count(*) FROM public.security_legacy_tables l JOIN pg_class c ON c.oid=l.table_oid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS legacy_tables_checked;
COMMIT;
