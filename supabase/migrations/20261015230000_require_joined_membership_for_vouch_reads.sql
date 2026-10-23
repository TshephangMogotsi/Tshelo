-- Personal involvement in a vouch does not grant continued fund access.
-- Authors, recipients and other ordinary users must all be joined members.
DROP POLICY IF EXISTS vouches_select ON public.member_vouches;
CREATE POLICY vouches_select ON public.member_vouches
  FOR SELECT TO authenticated
  USING (public.is_fund_member(fund_id));
