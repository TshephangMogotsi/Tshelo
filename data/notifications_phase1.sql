-- ============================================================
-- Tshelo — Notifications Phase 1
-- Run this whole file in the Supabase SQL editor.
--
-- What it does:
--   1. Adds the notification type values phase 1 needs to the
--      existing notifications.type enum (no-op for values that
--      already exist), and creates a create_notification() helper.
--   2. Locks the notifications table down with RLS: users can
--      read + mark-read their own rows only; nobody can insert
--      from the client.
--   3. Creates SECURITY DEFINER triggers that write notifications
--      server-side for:
--        - join request submitted            → fund owner + admins
--        - join request approved / declined  → the requester
--        - member joined (public fund)       → fund owner + admins
--        - member removed                    → the removed member
--        - contribution recorded             → all fund members
--        - expense recorded                  → all fund members
--          (one notification per save, even when a receipt review
--           inserts many expense rows at once)
--
-- Optional, before running: see what the enum already allows —
--   select atttypid::regtype as type_name
--   from pg_attribute
--   where attrelid = 'public.notifications'::regclass and attname = 'type';
--   select unnest(enum_range(null::notification_type));  -- use name from above
-- If it already has values that mean the same thing as the ones
-- below (e.g. 'fund_join_request'), tell Claude and we'll map to
-- those instead of adding new ones.
-- ============================================================


-- ── 1. Enum values + create_notification() helper ────────────
do $$
declare
  v_type_name text;
  v_is_enum   boolean;
  v_val       text;
begin
  select a.atttypid::regtype::text,
         t.typtype = 'e'
    into v_type_name, v_is_enum
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.notifications'::regclass
    and a.attname  = 'type';

  if v_is_enum then
    foreach v_val in array array[
      'join_request', 'join_approved', 'join_declined',
      'member_joined', 'member_removed',
      'contribution_added', 'expense_added'
    ] loop
      execute format('alter type %s add value if not exists %L', v_type_name, v_val);
    end loop;
  end if;

  execute format($fn$
    create or replace function public.create_notification(
      p_user_id uuid,
      p_fund_id uuid,
      p_type    text,
      p_title   text,
      p_body    text,
      p_data    jsonb default '{}'::jsonb
    ) returns void
    language sql
    security definer
    set search_path = public
    as $body$
      insert into public.notifications (user_id, fund_id, type, title, body, data)
      values (p_user_id, p_fund_id, p_type::%s, p_title, p_body, p_data);
    $body$;
  $fn$, v_type_name);
end $$;

-- Never callable from the client — only from the triggers below.
revoke execute on function public.create_notification(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;


-- ── 2. RLS + index on notifications ──────────────────────────
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);


-- ── 3. Recipient helpers ──────────────────────────────────────
-- Fund owner + admins (for "someone wants in / joined" notices).
create or replace function public.fund_manager_ids(p_fund_id uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select owner_id from public.funds where id = p_fund_id
  union
  select user_id from public.fund_members
  where fund_id = p_fund_id
    and status = 'joined'
    and role in ('owner', 'admin')
    and user_id is not null
$$;

-- Everyone in the fund (for money-movement transparency notices).
create or replace function public.fund_member_user_ids(p_fund_id uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select owner_id from public.funds where id = p_fund_id
  union
  select user_id from public.fund_members
  where fund_id = p_fund_id
    and status = 'joined'
    and user_id is not null
$$;

revoke execute on function public.fund_manager_ids(uuid)     from public, anon, authenticated;
revoke execute on function public.fund_member_user_ids(uuid) from public, anon, authenticated;


-- ── 4. fund_members: join requests / joins ────────────────────
create or replace function public.notify_fund_member_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_fund_title text;
  v_owner_id   uuid;
  v_name       text;
  v_recipient  uuid;
begin
  select title, owner_id into v_fund_title, v_owner_id
  from public.funds where id = new.fund_id;
  if v_fund_title is null then return new; end if;

  select name into v_name from public.users where id = new.user_id;
  v_name := coalesce(nullif(trim(v_name), ''), 'Someone');

  if new.status = 'pending' then
    for v_recipient in select * from public.fund_manager_ids(new.fund_id) loop
      if v_recipient is distinct from new.user_id then
        perform public.create_notification(
          v_recipient, new.fund_id, 'join_request',
          'New join request',
          v_name || ' requested to join ' || v_fund_title,
          jsonb_build_object('fundId', new.fund_id, 'memberRowId', new.id)
        );
      end if;
    end loop;

  elsif new.status = 'joined' and new.user_id is distinct from v_owner_id then
    for v_recipient in select * from public.fund_manager_ids(new.fund_id) loop
      if v_recipient is distinct from new.user_id then
        perform public.create_notification(
          v_recipient, new.fund_id, 'member_joined',
          'New member',
          v_name || ' joined ' || v_fund_title,
          jsonb_build_object('fundId', new.fund_id)
        );
      end if;
    end loop;
  end if;

  return new;
end $$;

drop trigger if exists trg_notify_fund_member_insert on public.fund_members;
create trigger trg_notify_fund_member_insert
  after insert on public.fund_members
  for each row execute function public.notify_fund_member_insert();


-- ── 5. fund_members: approved / declined / removed ────────────
create or replace function public.notify_fund_member_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_fund_title text;
  v_name       text;
  v_recipient  uuid;
begin
  if new.user_id is null or new.status = old.status then return new; end if;

  select title into v_fund_title from public.funds where id = new.fund_id;
  if v_fund_title is null then return new; end if;

  if old.status = 'pending' and new.status = 'joined' then
    perform public.create_notification(
      new.user_id, new.fund_id, 'join_approved',
      'Request approved',
      'You''re in! Your request to join ' || v_fund_title || ' was approved.',
      jsonb_build_object('fundId', new.fund_id)
    );

    -- also tell the fund's managers (including the approver) that a
    -- member was added — the approver seeing their own action confirmed
    -- is intentional (single-device demos and multi-admin funds alike)
    select name into v_name from public.users where id = new.user_id;
    v_name := coalesce(nullif(trim(v_name), ''), 'Someone');
    for v_recipient in select * from public.fund_manager_ids(new.fund_id) loop
      if v_recipient is distinct from new.user_id then
        perform public.create_notification(
          v_recipient, new.fund_id, 'member_joined',
          'New member',
          v_name || ' was added to ' || v_fund_title || '.',
          jsonb_build_object('fundId', new.fund_id)
        );
      end if;
    end loop;

  elsif old.status = 'pending' and new.status = 'declined' then
    perform public.create_notification(
      new.user_id, new.fund_id, 'join_declined',
      'Request declined',
      'Your request to join ' || v_fund_title || ' was declined.',
      jsonb_build_object('fundId', new.fund_id)
    );
  elsif old.status = 'joined' and new.status = 'removed' then
    perform public.create_notification(
      new.user_id, new.fund_id, 'member_removed',
      'Removed from fund',
      'You were removed from ' || v_fund_title || '.',
      jsonb_build_object('fundId', new.fund_id)
    );
  end if;

  return new;
end $$;

drop trigger if exists trg_notify_fund_member_update on public.fund_members;
create trigger trg_notify_fund_member_update
  after update on public.fund_members
  for each row execute function public.notify_fund_member_update();


-- ── 6. contributions: recorded ────────────────────────────────
create or replace function public.notify_contribution_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_fund_title text;
  v_currency   text;
  v_symbol     text;
  v_actor      uuid;
  v_recipient  uuid;
begin
  select title, currency_code into v_fund_title, v_currency
  from public.funds where id = new.fund_id;
  if v_fund_title is null then return new; end if;

  v_symbol := case when v_currency = 'BWP' then 'P' else v_currency end;
  v_actor  := coalesce(new.confirmed_by, new.tagged_by);

  for v_recipient in select * from public.fund_member_user_ids(new.fund_id) loop
    if v_recipient is distinct from v_actor then
      perform public.create_notification(
        v_recipient, new.fund_id, 'contribution_added',
        'Contribution recorded',
        v_symbol || ' ' || to_char(new.amount, 'FM999,999,990.00')
          || ' from ' || new.contributor_name || ' · ' || v_fund_title,
        jsonb_build_object('fundId', new.fund_id, 'contributionId', new.id)
      );
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists trg_notify_contribution_insert on public.contributions;
create trigger trg_notify_contribution_insert
  after insert on public.contributions
  for each row execute function public.notify_contribution_insert();


-- ── 7. expenses: recorded ─────────────────────────────────────
-- Statement-level with a transition table so a receipt review that
-- saves several expense rows in one insert produces ONE notification
-- per member, not one per line item.
create or replace function public.notify_expense_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_group      record;
  v_fund_title text;
  v_currency   text;
  v_symbol     text;
  v_body       text;
  v_recipient  uuid;
begin
  for v_group in
    select fund_id,
           count(*)                as cnt,
           sum(amount)             as total,
           max(vendor_name)        as vendor,
           max(added_by::text)::uuid as actor
    from new_rows
    group by fund_id
  loop
    select title, currency_code into v_fund_title, v_currency
    from public.funds where id = v_group.fund_id;
    if v_fund_title is null then continue; end if;

    v_symbol := case when v_currency = 'BWP' then 'P' else v_currency end;
    v_body := v_symbol || ' ' || to_char(v_group.total, 'FM999,999,990.00')
      || case when v_group.cnt > 1 then ' (' || v_group.cnt || ' items)' else '' end
      || coalesce(' at ' || nullif(trim(v_group.vendor), ''), '')
      || ' · ' || v_fund_title;

    for v_recipient in select * from public.fund_member_user_ids(v_group.fund_id) loop
      if v_recipient is distinct from v_group.actor then
        perform public.create_notification(
          v_recipient, v_group.fund_id, 'expense_added',
          'Expense recorded',
          v_body,
          jsonb_build_object('fundId', v_group.fund_id)
        );
      end if;
    end loop;
  end loop;

  return null;
end $$;

drop trigger if exists trg_notify_expense_insert on public.expenses;
create trigger trg_notify_expense_insert
  after insert on public.expenses
  referencing new table as new_rows
  for each statement execute function public.notify_expense_insert();
