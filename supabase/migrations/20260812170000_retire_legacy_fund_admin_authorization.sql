-- Final granular-administration cleanup. The admin role remains a relationship
-- label and a prerequisite for explicit grants, but it no longer authorizes an
-- operational or privileged read by itself.

DROP POLICY IF EXISTS fund_members_select_related ON public.fund_members;
CREATE POLICY fund_members_select_related
  ON public.fund_members
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR invited_by = auth.uid()
    OR public.is_fund_owner(fund_id)
    OR public.has_fund_permission(fund_id, 'manage_members')
    OR (
      status = 'joined'::public.member_status
      AND public.is_fund_member(fund_id)
    )
  );

-- Joined members may see the public-in-fund directory. Pending or otherwise
-- inactive profiles are visible only to the person concerned, their inviter,
-- the owner, or an admin who was explicitly granted member management.
CREATE OR REPLACE FUNCTION public.get_fund_member_profiles(p_fund_id uuid)
RETURNS TABLE(member_row_id uuid, user_id uuid, name text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT membership.id, profile.id, profile.name, profile.phone
  FROM public.fund_members AS membership
  JOIN public.users AS profile ON profile.id = membership.user_id
  WHERE membership.fund_id = p_fund_id
    AND (
      public.is_fund_owner(p_fund_id)
      OR EXISTS (
        SELECT 1
        FROM public.fund_members AS caller
        WHERE caller.fund_id = p_fund_id
          AND caller.user_id = auth.uid()
          AND caller.status = 'joined'::public.member_status
      )
    )
    AND (
      membership.status = 'joined'::public.member_status
      OR membership.user_id = auth.uid()
      OR membership.invited_by = auth.uid()
      OR public.is_fund_owner(p_fund_id)
      OR public.has_fund_permission(p_fund_id, 'manage_members')
    )
  ORDER BY membership.joined_at NULLS LAST, membership.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_fund_member_profiles(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fund_member_profiles(uuid)
  TO authenticated, service_role;

-- Keep the helper temporarily for server-side relationship diagnostics, but
-- prevent client RPC use and make accidental policy reuse conspicuous.
REVOKE ALL ON FUNCTION public.is_fund_admin(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_fund_admin(uuid)
  TO service_role;
COMMENT ON FUNCTION public.is_fund_admin(uuid) IS
  'Deprecated relationship helper. Client execution is revoked. Operational authorization must use has_fund_permission with an explicit capability.';
