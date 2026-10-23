-- Reproduce the existing profile API boundary without relying on platform
-- defaults. Fresh Supabase stacks do not automatically grant access to tables
-- created by application migrations. RLS and restricted client writes stay intact.
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.users'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Profile API grants require users row-level security';
  END IF;
END $$;

GRANT SELECT ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;

COMMIT;
