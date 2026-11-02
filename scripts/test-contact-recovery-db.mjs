import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const user = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const id = '00000000-0000-4000-8000-000000000003'
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261028150000_contact_recovery_challenges.sql', import.meta.url), 'utf8'))
  await db.query('INSERT INTO auth.users(id) VALUES ($1),($2)', [user, other])
  await db.exec("SELECT set_config('request.jwt.claim.role', 'service_role', false)")
  const start = await db.query("SELECT public.create_contact_recovery_challenge($1,$2,'email','new@example.test','26770000000','digest') AS created", [id, user])
  assert.equal(start.rows[0].created, true)
  const consume = (subject, proof) => db.query("SELECT * FROM public.consume_contact_recovery_challenge($1,$2,'email',$3)", [id, subject, proof])
  assert.equal((await consume(other, 'digest')).rows.length, 0)
  for (let i = 0; i < 4; i++) assert.equal((await consume(user, 'wrong')).rows.length, 0)
  assert.deepEqual((await consume(user, 'digest')).rows, [{ destination: 'new@example.test', source: '26770000000' }])
  assert.equal((await consume(user, 'digest')).rows.length, 0)
  await db.exec("SELECT set_config('request.jwt.claim.role', 'authenticated', false)")
  await assert.rejects(consume(user, 'digest'), /FORBIDDEN/)
  console.log('PASS: account binding, bounded attempts, single use and service-only access')
} finally { await db.close() }
