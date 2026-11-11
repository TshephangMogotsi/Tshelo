import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')
const id = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'

test('email-only signup uses an expiring, single-use ID/email approval before metadata exists', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_setting('request.jwt.claim.role',true)$$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, phone text, raw_app_meta_data jsonb DEFAULT '{}',raw_user_meta_data jsonb DEFAULT '{}');
      CREATE TABLE public.users(id uuid PRIMARY KEY, email text, phone text, name text);`)
    await db.exec(await migration('20261102090000_bind_beta_signup_authorization.sql'))
    await db.exec('CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()')
    const insert = (uid, email) => db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [uid,email])
    await assert.rejects(insert(id,'approved@example.test'), /not enabled/)
    await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false)")
    const approve = () => db.query("SELECT public.authorize_beta_signup($1,'approved@example.test')",[id])
    await approve()
    await assert.rejects(insert(other,'approved@example.test'), /not enabled/)
    await assert.rejects(insert(id,'wrong@example.test'), /not enabled/)
    await db.exec("UPDATE public.beta_signup_authorizations SET expires_at=now()-interval '1 second'")
    await assert.rejects(insert(id,'approved@example.test'), /not enabled/)
    await approve()
    await insert(id,'approved@example.test')
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.beta_signup_authorizations')).rows[0].n,0)
    assert.equal((await db.query('SELECT email FROM public.users WHERE id=$1',[id])).rows[0].email,'approved@example.test')
    await db.query('DELETE FROM auth.users WHERE id=$1',[id])
    await assert.rejects(insert(id,'approved@example.test'), /not enabled/)
    await db.exec('SET ROLE anon')
    await assert.rejects(db.query('SELECT * FROM public.beta_signup_authorizations'),/permission denied/)
    await assert.rejects(approve(),/permission denied/)
  } finally { await db.close() }
})

test('direct payment RPC requires recent signed OTP/MFA proof; token refresh is insufficient', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${id}'::uuid$$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT current_setting('request.jwt.claims',true)::jsonb$$;
      CREATE TYPE public.payment_method AS ENUM('orange_money');
      CREATE TYPE public.notification_type AS ENUM('system_announcement');
      CREATE TABLE public.users(id uuid PRIMARY KEY,deleted_at timestamptz,
        mobile_money_provider payment_method,mobile_money_number_ciphertext bytea,mobile_money_name text,
        bank_name text,bank_account_number_ciphertext bytea,bank_account_name text,bank_branch_code text,
        mobile_money_verified boolean,mobile_money_verified_at timestamptz,bank_account_verified boolean,bank_account_verified_at timestamptz,updated_at timestamptz);
      CREATE TABLE public.notifications(user_id uuid,type notification_type,title text,body text,data jsonb);
      CREATE FUNCTION public.decrypt_payment_identifier(bytea) RETURNS text LANGUAGE sql AS $$SELECT convert_from($1,'UTF8')$$;
      CREATE FUNCTION public.encrypt_payment_identifier(text) RETURNS bytea LANGUAGE sql AS $$SELECT convert_to($1,'UTF8')$$;
      INSERT INTO public.users(id) VALUES('${id}');`)
    await db.exec(await migration('20261102100000_require_recent_payment_auth.sql'))
    const now = Math.floor(Date.now()/1000)
    const claims = amr => db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({iat:now,amr})])
    const change = () => db.query("SELECT public.update_own_payment_details('{\"bank_account_number\":\"TEST-ACCOUNT\"}')")
    for (const amr of [[],null,{},[{method:'otp',timestamp:now-601}],[{method:'token_refresh',timestamp:now}],[{method:'password',timestamp:now}],[{method:'otp',timestamp:now+120}],[{method:'otp',timestamp:'invalid'}]]) {
      await claims(amr)
      await assert.rejects(change(), error => error.code==='PT401')
    }
    assert.equal((await db.query('SELECT bank_account_number_ciphertext FROM public.users')).rows[0].bank_account_number_ciphertext,null)
    for (const method of ['otp','totp','mfa/totp']) {
      await claims([{method,timestamp:now}])
      await change()
    }
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.notifications')).rows[0].n,1)
  } finally { await db.close() }
})
