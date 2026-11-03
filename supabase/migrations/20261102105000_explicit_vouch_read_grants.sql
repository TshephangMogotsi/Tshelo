-- Fresh Supabase stacks do not supply legacy automatic table grants. Declare
-- the read access already required by the joined-only vouch policy and tests.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.member_vouches'::regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.fund_members'::regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.member_vouches'::regclass AND polname='vouches_select') THEN
    RAISE EXCEPTION 'Vouch reads require the joined-membership RLS policy';
  END IF;
END $$;
GRANT SELECT ON public.member_vouches, public.fund_members TO authenticated, service_role;
