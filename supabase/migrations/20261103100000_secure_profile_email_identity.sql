-- Audit item 2: verified Auth email is authoritative for account identity.
-- Atomic and compatible with the currently deployed deletion-request route:
-- its existing INSERT is bound by a database trigger, even before API rollout.
BEGIN;
CREATE OR REPLACE FUNCTION public.sync_verified_auth_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND (NEW.email IS DISTINCT FROM OLD.email
    OR (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)) THEN
    IF NEW.email_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'EMAIL_CHANGE_REQUIRES_VERIFICATION';
    END IF;
    UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'EMAIL_CHANGE_PROFILE_MISSING';
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.id,
      'system_announcement'::public.notification_type,
      'Sign-in email changed',
      'Your Tshelo sign-in email was changed. If this was not you, contact support immediately.',
      jsonb_build_object('security_event', 'email_change')
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_verified_auth_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_email_changed ON auth.users;
CREATE TRIGGER on_auth_email_changed
AFTER UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_verified_auth_email();

-- Defense for trusted callers too: a profile cannot claim a different address
-- from that account's confirmed Auth address. Other profile edits still work.
CREATE OR REPLACE FUNCTION public.enforce_verified_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email
    AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id=NEW.id
      AND a.email_confirmed_at IS NOT NULL AND lower(a.email)=lower(NEW.email)) THEN
    RAISE EXCEPTION 'PROFILE_EMAIL_REQUIRES_VERIFIED_AUTH' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_verified_profile_email() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS enforce_verified_profile_email ON public.users;
CREATE TRIGGER enforce_verified_profile_email BEFORE UPDATE OF email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_profile_email();

-- Repair historical differences from the authoritative confirmed identity.
-- Unconfirmed Auth addresses never overwrite an existing profile email.
UPDATE public.users u SET email=a.email FROM auth.users a
WHERE a.id=u.id AND a.email_confirmed_at IS NOT NULL AND a.email IS NOT NULL
  AND u.deleted_at IS NULL AND u.email IS DISTINCT FROM a.email;

-- Use confirmed Auth identities, never public.users.email. Ambiguity fails
-- closed even if a future Auth provider permits duplicate confirmed addresses.
CREATE OR REPLACE FUNCTION public.resolve_verified_closure_account(p_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN count(*)=1 THEN (array_agg(a.id))[1] ELSE NULL END
  FROM auth.users a JOIN public.users u ON u.id=a.id
  WHERE lower(a.email)=lower(btrim(p_email)) AND a.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.resolve_verified_closure_account(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_verified_closure_account(text) TO service_role;

ALTER TABLE public.account_closure_verifications
  ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.bind_verified_closure_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid;
BEGIN
  NEW.contact_email := lower(btrim(NEW.contact_email));
  owner_id := public.resolve_verified_closure_account(NEW.contact_email);
  IF owner_id IS NULL OR (NEW.account_user_id IS NOT NULL AND NEW.account_user_id<>owner_id) THEN
    RAISE EXCEPTION 'CLOSURE_VERIFIED_ACCOUNT_REQUIRED' USING ERRCODE='42501';
  END IF;
  NEW.account_user_id := owner_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bind_verified_closure_account() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS bind_verified_closure_account ON public.account_closure_verifications;
CREATE TRIGGER bind_verified_closure_account BEFORE INSERT OR UPDATE OF contact_email,account_user_id
  ON public.account_closure_verifications FOR EACH ROW EXECUTE FUNCTION public.bind_verified_closure_account();
-- Existing tokens remain unbound and cannot create tickets; users can request
-- a new link. No historical profile email is treated as proof of identity.
create or replace function public.consume_verified_account_closure_request(p_token_hash text)
returns table(ticket_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verification public.account_closure_verifications%rowtype;
  matched_user_id uuid;
  existing_ticket_number text;
  created_ticket_number text;
begin
  select * into verification
  from public.account_closure_verifications
  where token_hash = p_token_hash
    and consumed_at is null
    and expires_at > now()
  for update;

  if verification.id is null then
    return;
  end if;

  update public.account_closure_verifications
  set consumed_at = now()
  where id = verification.id;

  -- Never re-resolve identity using the user-editable/historical profile email.
  -- Legacy unbound tokens fail closed. Email changes invalidate old tokens.
  matched_user_id := public.resolve_verified_closure_account(verification.contact_email);
  if verification.account_user_id is null
    or matched_user_id is distinct from verification.account_user_id then
    return;
  end if;

  if matched_user_id is null then
    return;
  end if;

  select ticket.ticket_number into existing_ticket_number
  from public.support_tickets as ticket
  where ticket.user_id = matched_user_id
    and ticket.category = 'account_closure'
    and ticket.status in ('open', 'pending', 'in_progress')
  order by ticket.created_at desc
  limit 1;

  if existing_ticket_number is not null then
    return query select existing_ticket_number;
    return;
  end if;

  insert into public.support_tickets (user_id, category, subject, description, priority, status)
  values (
    matched_user_id,
    'account_closure',
    'Account closure request',
    concat(
      'Verified public web account-deletion request.', E'\n',
      'Contact email: ', verification.contact_email, E'\n',
      'Tshelo mobile: ', coalesce(verification.account_phone, 'Not provided'), E'\n',
      'Notes: ', coalesce(verification.notes, 'Not provided')
    ),
    'normal',
    'open'
  )
  returning support_tickets.ticket_number into created_ticket_number;

  return query select created_ticket_number;
end;
$$;

revoke all on function public.consume_verified_account_closure_request(text) from public, anon, authenticated;
grant execute on function public.consume_verified_account_closure_request(text) to service_role;


SELECT public.assert_application_table_security();
NOTIFY pgrst, 'reload schema';
COMMIT;
