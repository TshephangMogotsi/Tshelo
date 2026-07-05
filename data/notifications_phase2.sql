-- ============================================================
-- Tshelo — Notifications Phase 2 (push delivery)
-- Run this whole file in the Supabase SQL editor AFTER
-- notifications_phase1.sql. Idempotent — safe to re-run.
--
-- What it does:
--   1. Creates push_tokens — one row per device, holding that
--      device's Expo push token. Unlike the notifications table,
--      the client DOES write here directly (it's the only thing
--      that knows its own device's token), scoped to its own
--      user_id by RLS.
--
-- After running this file, also set up the Database Webhook in
-- the dashboard (Database → Webhooks) — see
-- supabase/functions/send-push/README.md for exact steps. That
-- part can't be scripted from SQL.
-- ============================================================

create table if not exists public.push_tokens (
  id                uuid not null default uuid_generate_v4(),
  user_id           uuid not null,
  expo_push_token   text not null,
  device_id         character varying,
  platform          character varying,
  updated_at        timestamp with time zone default now(),
  created_at        timestamp with time zone default now(),
  constraint push_tokens_pkey primary key (id),
  constraint push_tokens_user_id_fkey foreign key (user_id) references public.users(id),
  constraint push_tokens_token_unique unique (expo_push_token)
);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own on public.push_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = auth.uid());

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
