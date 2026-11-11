-- Read-only pre/post rollout evidence. Contains schema metadata, never rows.
-- Save the result securely before applying the migration. The old guard and
-- table/column ACLs provide the metadata needed for an operator rollback.
BEGIN READ ONLY;
SELECT jsonb_build_object(
  'captured_at', clock_timestamp(),
  'database', current_database(),
  'guard_definition', pg_get_functiondef('public.assert_application_table_security()'::regprocedure),
  'tables', (SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname, 'owner', pg_get_userbyid(c.relowner),
    'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
    'acl', c.relacl,
    'columns', (SELECT jsonb_agg(jsonb_build_object('column', a.attname, 'acl', a.attacl) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)
  ) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')),
  'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname)
    FROM pg_policies p WHERE p.schemaname='public')
) AS legacy_grants_snapshot;
COMMIT;
