-- Public account-closure requests must be verified by the holder of the
-- registered email address before a support ticket is created.
create table if not exists public.account_closure_verifications (
  id uuid primary key default gen_random_uuid(),
  contact_email text not null,
  account_phone text,
  notes text,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.account_closure_verifications enable row level security;
revoke all on table public.account_closure_verifications from public, anon, authenticated;
grant select, insert, update on table public.account_closure_verifications to service_role;

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

  select u.id into matched_user_id
  from public.users as u
  where u.deleted_at is null
    and lower(u.email) = verification.contact_email
  order by u.created_at desc
  limit 1;

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

-- Retire the direct anonymous RPC. The public web form now uses a server-only
-- service role after email verification.
revoke all on function public.submit_public_account_closure_request(text, text, text) from public, anon, authenticated;
