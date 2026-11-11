-- Future objects only: existing table, sequence and function ACLs are unchanged.
-- Application migrations create objects as postgres. Schema defaults add to
-- global defaults, so both scopes must exclude automatic browser-role access.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- A schema-only REVOKE cannot remove PostgreSQL's implicit global PUBLIC EXECUTE.
-- This global function default affects future postgres-owned functions in every
-- schema. Future functions intended for clients need an explicit migration grant.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Deliberately does not attempt to change managed-role supabase_admin defaults.
