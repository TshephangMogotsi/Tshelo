BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH creators AS (
 SELECT oid,rolname FROM pg_roles WHERE rolname IN ('postgres','supabase_admin')
), kinds(kind,label) AS (VALUES ('r'::"char",'tables'),('f'::"char",'functions'),('S'::"char",'sequences')),
effective AS (
 SELECT c.rolname,k.label,'global' AS scope,a.grantee,a.privilege_type,a.is_grantable
 FROM creators c CROSS JOIN kinds k
 LEFT JOIN pg_default_acl d ON d.defaclrole=c.oid AND d.defaclobjtype=k.kind AND d.defaclnamespace=0
 CROSS JOIN LATERAL aclexplode(COALESCE(d.defaclacl,acldefault(k.kind,c.oid))) a
 UNION ALL
 SELECT c.rolname,k.label,'public schema' AS scope,a.grantee,a.privilege_type,a.is_grantable
 FROM creators c CROSS JOIN kinds k
 JOIN pg_default_acl d ON d.defaclrole=c.oid AND d.defaclobjtype=k.kind AND d.defaclnamespace='public'::regnamespace
 CROSS JOIN LATERAL aclexplode(d.defaclacl) a
), client_defaults AS (
 SELECT e.rolname AS creator,label AS object_type,scope,COALESCE(r.rolname,'PUBLIC') AS grantee,privilege_type,is_grantable
 FROM effective e LEFT JOIN pg_roles r ON r.oid=e.grantee
 WHERE e.grantee=0 OR r.rolname IN ('anon','authenticated')
)
SELECT jsonb_build_object(
 'database',current_database(),'query_role',current_user,
 'public_table_count',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p')),
 'tables_without_rls',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p') AND NOT relrowsecurity),
 'client_defaults',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM client_defaults x),'[]'::jsonb),
 'explicit_defaults',COALESCE((SELECT jsonb_agg(jsonb_build_object('creator',r.rolname,'schema',COALESCE(n.nspname,'GLOBAL'),'kind',d.defaclobjtype,'acl',d.defaclacl::text)) FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE r.rolname IN ('postgres','supabase_admin')),'[]'::jsonb),
 'existing_acl_fingerprints',jsonb_build_object(
 'tables_and_sequences',(SELECT md5(string_agg(c.oid::text||':'||c.relname||':'||COALESCE(c.relacl::text,'<implicit>'),E'\n' ORDER BY c.oid)) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','S')),
 'functions',(SELECT md5(string_agg(p.oid::text||':'||p.oid::regprocedure::text||':'||COALESCE(p.proacl::text,'<implicit>'),E'\n' ORDER BY p.oid)) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace)
 )) AS report;
ROLLBACK;
