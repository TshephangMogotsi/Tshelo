-- Keep relationship-scoped connection search deterministic while satisfying
-- PostgreSQL's SELECT DISTINCT ordering rule. The selected name expression is
-- column 2 of the RPC result, so order by that output rather than the
-- differently typed source column.
CREATE OR REPLACE FUNCTION public.search_my_connections(p_query text)
RETURNS TABLE(user_id uuid, name text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  clean_query text := replace(replace(trim(coalesce(p_query, '')), '%', ''), '_', '');
  phone_query text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF length(clean_query) < 2 THEN
    RETURN;
  END IF;

  phone_query := public.normalized_phone(clean_query);

  RETURN QUERY
  SELECT DISTINCT u.id, u.name::text, u.phone::text
  FROM public.users u
  WHERE u.id <> caller_id
    AND (
      u.name ILIKE '%' || clean_query || '%'
      OR (length(phone_query) >= 3 AND public.normalized_phone(u.phone) LIKE '%' || phone_query)
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.fund_members mine
        JOIN public.fund_members theirs ON theirs.fund_id = mine.fund_id
        WHERE mine.user_id = caller_id
          AND mine.status = 'joined'::public.member_status
          AND theirs.user_id = u.id
          AND theirs.status = 'joined'::public.member_status
      )
      OR EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.event_organisers theirs
          ON theirs.event_id = e.id
         AND theirs.user_id = u.id
         AND theirs.status = 'active'
        WHERE e.creator_id = caller_id
          OR EXISTS (
            SELECT 1 FROM public.event_organisers mine
            WHERE mine.event_id = e.id
              AND mine.user_id = caller_id
              AND mine.status = 'active'
          )
      )
    )
  ORDER BY 2
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.search_my_connections(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_my_connections(text) TO authenticated;

COMMENT ON FUNCTION public.search_my_connections(text) IS
  'Returns at most ten relationship-scoped users matching a sanitized name or phone query.';
