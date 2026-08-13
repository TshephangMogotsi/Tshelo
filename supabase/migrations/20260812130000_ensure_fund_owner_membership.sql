-- A fund and its organiser membership are one logical record. Create them in
-- the same transaction so a failed second client request can never leave a
-- valid fund reporting zero members.

CREATE OR REPLACE FUNCTION public.ensure_fund_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fund_members (
    fund_id,
    user_id,
    invited_by,
    role,
    status,
    joined_at
  ) VALUES (
    NEW.id,
    NEW.owner_id,
    NEW.owner_id,
    'owner'::public.member_role,
    'joined'::public.member_status,
    coalesce(NEW.created_at, now())
  )
  ON CONFLICT (fund_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_fund_owner_membership()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ensure_fund_owner_membership ON public.funds;
CREATE CONSTRAINT TRIGGER ensure_fund_owner_membership
  AFTER INSERT ON public.funds
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_fund_owner_membership();

-- Repair older funds that were created before membership insertion completed.
INSERT INTO public.fund_members (
  fund_id,
  user_id,
  invited_by,
  role,
  status,
  joined_at
)
SELECT
  fund.id,
  fund.owner_id,
  fund.owner_id,
  'owner'::public.member_role,
  'joined'::public.member_status,
  coalesce(fund.created_at, now())
FROM public.funds AS fund
WHERE fund.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.fund_members AS existing
    WHERE existing.fund_id = fund.id
      AND existing.user_id = fund.owner_id
  )
ON CONFLICT (fund_id, user_id) DO NOTHING;
