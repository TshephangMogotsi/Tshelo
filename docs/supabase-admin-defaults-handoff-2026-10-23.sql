-- REVIEW/HANDOFF ONLY: not executed by this change.
-- Target project: albihofmlafjzbusancu. Requires an authorized supabase_admin
-- member or Supabase support. The current postgres connection lacks that role.
-- Changes future defaults only; does not revoke existing object permissions.
-- Global FUNCTION revocation applies to future managed-role functions in every
-- schema; schema-level revocation alone cannot cancel implicit PUBLIC EXECUTE.
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
COMMIT;
-- Re-run scripts/inspect-future-object-defaults.sql. The client_defaults list
-- should have no entries for either postgres or supabase_admin.
