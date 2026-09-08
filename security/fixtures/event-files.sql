-- Minimal surrounding schema for running the REAL permission helpers and
-- event-file migrations in a disposable PostgreSQL database.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA public, auth, storage TO authenticated, anon, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.member_status AS ENUM ('pending', 'joined', 'left', 'removed', 'declined');
CREATE TABLE public.users (id uuid PRIMARY KEY);
CREATE TABLE public.funds (id uuid PRIMARY KEY, owner_id uuid, deleted_at timestamptz);
CREATE TABLE public.fund_members (
  fund_id uuid, user_id uuid, role public.member_role, status public.member_status
);
CREATE TABLE public.fund_permission_definitions (
  permission_key text PRIMARY KEY, label text, description text, is_active boolean DEFAULT true
);
CREATE TABLE public.fund_admin_permissions (fund_id uuid, user_id uuid, permission_key text);
CREATE TABLE public.events (
  id uuid PRIMARY KEY, creator_id uuid, linked_fund_id uuid, status text DEFAULT 'active', deleted_at timestamptz
);
CREATE TABLE public.event_organisers (event_id uuid, user_id uuid, status text);
CREATE TABLE public.event_guests (event_id uuid, user_id uuid);
CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text, metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$
  SELECT (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1)-1];
$$;
