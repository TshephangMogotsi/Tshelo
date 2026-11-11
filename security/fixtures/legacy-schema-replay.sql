-- Disposable PGlite host substitutes for structural/ACL replay only.
-- Auth token helpers model Supabase claims; Storage, Vault and Cron are minimal
-- catalog fixtures. No real crypto, networking, scheduler or hosted Auth runs.
-- Public application tables/policies/functions come from the real migrations.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA cron;
CREATE TABLE cron.job(jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,jobname text UNIQUE,schedule text,command text,active boolean DEFAULT true,username text DEFAULT current_user,database text DEFAULT current_database());
CREATE TABLE cron.job_run_details(runid bigint,jobid bigint,status text,start_time timestamptz,end_time timestamptz);
CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$INSERT INTO cron.job(jobname,schedule,command) VALUES($1,$2,$3) ON CONFLICT(jobname) DO UPDATE SET schedule=$2,command=$3 RETURNING jobid$$;
CREATE FUNCTION cron.unschedule(bigint) RETURNS boolean LANGUAGE sql AS $$DELETE FROM cron.job WHERE jobid=$1 RETURNING true$$;
CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA vault;
SET search_path=public,extensions;
CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, phone text, phone_change text, raw_user_meta_data jsonb, raw_app_meta_data jsonb, email_confirmed_at timestamptz, phone_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''), auth.jwt()->>'role')$$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;
CREATE TABLE vault.secrets(id uuid DEFAULT gen_random_uuid(),name text, decrypted_secret text);
INSERT INTO vault.secrets(name,decrypted_secret) VALUES('payment_identifiers_encryption_v1',repeat('x',64));
CREATE VIEW vault.decrypted_secrets AS SELECT * FROM vault.secrets;
GRANT USAGE ON SCHEMA auth,public,extensions,storage TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
