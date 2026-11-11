import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, phone text UNIQUE, phone_change text, phone_confirmed_at timestamptz, last_sign_in_at timestamptz);
    CREATE TYPE public.notification_type AS ENUM ('system_announcement');
    CREATE TABLE public.users (id uuid PRIMARY KEY REFERENCES auth.users(id), phone text UNIQUE, name text, token_balance int);
    CREATE TABLE public.notifications (id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL, type public.notification_type NOT NULL, title text NOT NULL, body text NOT NULL, data jsonb NOT NULL DEFAULT '{}');
    CREATE TABLE public.funds (id int PRIMARY KEY, owner_id uuid REFERENCES public.users(id));
    CREATE TABLE public.contributions (id int PRIMARY KEY, user_id uuid REFERENCES public.users(id), amount int);
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT ON public.users TO authenticated;
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/20261006120000_sync_verified_phone_changes.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261006130000_harden_phone_change_verification.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261006140000_require_fresh_phone_change_auth.sql', import.meta.url), 'utf8'))
  await db.query("INSERT INTO auth.users VALUES ($1,'26771234567',NULL,now(),now()), ($2,'26774567890',NULL,now(),now())", [owner, other])
  await db.query("INSERT INTO public.users VALUES ($1,'26771234567','Autumn',75), ($2,'+26774567890','Other',0)", [owner, other])
  await db.query('INSERT INTO funds VALUES (1,$1);', [owner])
  await db.query('INSERT INTO contributions VALUES (1,$1,500);', [owner])
  await db.query("UPDATE auth.users SET phone_change='26772345678' WHERE id=$1", [owner])
  assert.equal((await db.query('SELECT phone FROM public.users WHERE id=$1', [owner])).rows[0].phone, '26771234567')
  await db.query("UPDATE auth.users SET phone='26772345678',phone_change=NULL,phone_confirmed_at=now() WHERE id=$1", [owner])
  assert.deepEqual((await db.query('SELECT * FROM public.users WHERE id=$1', [owner])).rows[0], { id: owner, phone: '26772345678', name: 'Autumn', token_balance: 75 })
  assert.deepEqual((await db.query('SELECT title, data->>\'new_phone_last4\' AS last4 FROM public.notifications WHERE user_id=$1', [owner])).rows[0], { title: 'Sign-in number changed', last4: '5678' })
  assert.equal((await db.query('SELECT owner_id FROM funds')).rows[0].owner_id, owner)
  assert.deepEqual((await db.query('SELECT user_id,amount FROM contributions')).rows[0], { user_id: owner, amount: 500 })
  // Profile conflicts (including a legacy leading +) must roll back Auth too.
  await db.query("UPDATE auth.users SET phone='26775678901' WHERE id=$1", [other])
  await db.query("UPDATE public.users SET phone='+26774567890' WHERE id=$1", [other])
  await assert.rejects(db.query("UPDATE auth.users SET phone='26774567890' WHERE id=$1", [owner]), /PHONE_ALREADY_IN_USE/)
  assert.equal((await db.query('SELECT phone FROM auth.users WHERE id=$1', [owner])).rows[0].phone, '26772345678')
  await assert.rejects(db.query("UPDATE auth.users SET phone='26773456789',phone_confirmed_at=NULL WHERE id=$1", [owner]), /VERIFICATION/)
  await db.query("UPDATE auth.users SET phone_change='26779999999' WHERE id=$1", [owner])
  await assert.rejects(db.query("UPDATE auth.users SET phone_change='26779999999' WHERE id=$1", [other]), /PHONE_CHANGE_ALREADY_PENDING/)
  await db.query("UPDATE auth.users SET last_sign_in_at=now() - INTERVAL '11 minutes', phone_change=NULL WHERE id=$1", [owner])
  await assert.rejects(db.query("UPDATE auth.users SET phone_change='26778888888' WHERE id=$1", [owner]), /PHONE_CHANGE_REAUTHENTICATION_REQUIRED/)
  await db.exec('SET ROLE authenticated')
  await assert.rejects(db.query("UPDATE public.users SET phone='26773456789' WHERE id=$1", [owner]), /permission denied/)
  await assert.rejects(db.query('SELECT public.sync_verified_auth_phone()'), /permission denied/)
  console.log('Phone-change database checks passed: pending isolation, account/data preservation, conflict rollback, verification and permissions.')
} finally { await db.close() }
