-- Records public account-deletion requests without allowing the caller to
-- delete or modify an account. Support must verify ownership before action.
CREATE OR REPLACE FUNCTION public.submit_public_account_closure_request(
  p_contact_email text,
  p_account_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(ticket_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  matched_user_id uuid;
  existing_ticket_number text;
  created_ticket_number text;
  normalized_email text := lower(btrim(p_contact_email));
  normalized_phone text := NULLIF(btrim(p_account_phone), '');
  normalized_notes text := NULLIF(btrim(p_notes), '');
BEGIN
  IF normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR length(normalized_email) > 255
    OR length(normalized_phone) > 24
    OR length(normalized_notes) > 500 THEN
    RAISE EXCEPTION 'Invalid account-deletion request details' USING ERRCODE = '22023';
  END IF;

  SELECT u.id
  INTO matched_user_id
  FROM public.users AS u
  WHERE u.deleted_at IS NULL
    AND (lower(u.email) = normalized_email OR (normalized_phone IS NOT NULL AND u.phone = normalized_phone))
  ORDER BY u.created_at DESC
  LIMIT 1;

  -- Do not let an unauthenticated RPC create arbitrary support tickets. A
  -- non-matching request is handled by the website's rate-limited support
  -- email path, without revealing whether an account exists.
  IF matched_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT ticket.ticket_number
  INTO existing_ticket_number
  FROM public.support_tickets AS ticket
  WHERE ticket.user_id = matched_user_id
    AND ticket.category = 'account_closure'
    AND ticket.status IN ('open', 'pending', 'in_progress')
  ORDER BY ticket.created_at DESC
  LIMIT 1;

  IF existing_ticket_number IS NOT NULL THEN
    RETURN QUERY SELECT existing_ticket_number;
    RETURN;
  END IF;

  INSERT INTO public.support_tickets (
    user_id,
    category,
    subject,
    description,
    priority,
    status
  )
  VALUES (
    matched_user_id,
    'account_closure',
    'Account closure request',
    concat(
      'Public web account-deletion request. Verify account ownership before any action.', E'\n',
      'Contact email: ', normalized_email, E'\n',
      'Tshelo mobile: ', coalesce(normalized_phone, 'Not provided'), E'\n',
      'Notes: ', coalesce(normalized_notes, 'Not provided')
    ),
    'normal',
    'open'
  )
  RETURNING support_tickets.ticket_number INTO created_ticket_number;

  RETURN QUERY SELECT created_ticket_number;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_account_closure_request(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_account_closure_request(text, text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_public_account_closure_request(text, text, text) IS
  'Records a public account-deletion request only when it matches an existing active account. It never deletes an account; support must verify ownership before processing.';
