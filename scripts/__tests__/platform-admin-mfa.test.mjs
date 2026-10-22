import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')
const admin = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const original = await migration('20260817140000_api_source_of_truth_rpcs.sql')

before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
    CREATE TABLE users(id uuid PRIMARY KEY, name text, is_flagged boolean DEFAULT false, is_banned boolean DEFAULT false, banned_at timestamptz, banned_reason text, banned_by uuid, deleted_at timestamptz, updated_at timestamptz);
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_profile ON users FOR SELECT TO authenticated USING (id=auth.uid());
  `)
  for (const table of ['funds','events','support_tickets','disputes','fraud_signals','contributions','expenses','audit_log']) {
    await db.exec(`CREATE TABLE ${table}(id uuid PRIMARY KEY); ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT SELECT ON ${table} TO authenticated`)
  }
  await db.exec(await migration('20261022110000_explicit_profile_api_grants.sql'))
  await db.exec(await migration('20260814120000_platform_admin_console.sql'))
  // Exercise the real public moderation RPC, including its nested authorization
  // and atomic audit write, with only unrelated application columns stubbed.
  const start = original.indexOf('CREATE OR REPLACE FUNCTION public.platform_admin_update_support_ticket(')
  await db.exec(original.slice(start))
  await db.exec(await migration('20261022120000_require_platform_admin_mfa.sql'))
  await db.query("INSERT INTO users(id,name) VALUES ($1,'Admin'),($2,'Other')", [admin,other])
  await db.query("INSERT INTO platform_admins(user_id,role) VALUES ($1,'super_admin')", [admin])
  await db.query('INSERT INTO funds(id) VALUES ($1)', [other])
  // Another inactive admin tests that aal1 lookup exposes only the caller.
  await db.query("INSERT INTO platform_admins(user_id,role,is_active) VALUES ($1,'support',false)",[other])
})
after(() => db.close())

async function session(role, aal, active=true, user=admin) {
  await db.exec('RESET ROLE')
  await db.query('UPDATE platform_admins SET role=$1,is_active=$2 WHERE user_id=$3',[role,active,admin])
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [user,JSON.stringify({sub:user,...(aal ? {aal} : {})})])
  await db.exec('SET ROLE authenticated')
}
async function read(sql, params=[]) { return (await db.query(sql,params)).rows }

for (const role of ['support','operations','finance','super_admin']) {
  test(`${role}: insufficient assurance blocks platform reads and direct privileged RPC`, async () => {
    for (const level of [undefined,'aal1','invalid']) {
      await session(role,level)
      assert.equal((await read('SELECT public.is_platform_admin() AS allowed'))[0].allowed,false)
      assert.equal((await read('SELECT * FROM users')).length,1,'ordinary own-profile access survives')
      assert.equal((await read('SELECT * FROM funds')).length,0)
      assert.equal((await read('SELECT * FROM platform_admins')).length,1,'self role lookup supports enrollment')
      for (const [sql, params] of [
        ["SELECT public.platform_admin_moderate_user($1,'flag','MFA test')", [other]],
        ["SELECT public.platform_admin_update_support_ticket($1,'{}'::jsonb)", [other]],
        ["SELECT public.platform_admin_moderate_fund($1,'close','MFA test')", [other]],
        ["SELECT public.platform_admin_upsert($1,'support','active')", [other]],
      ]) await assert.rejects(db.query(sql,params), /Multi-factor verification required/)
    }
  })
  test(`${role}: MFA unlocks platform reads but preserves operation permissions`, async () => {
    await session(role,'aal2')
    assert.equal((await read('SELECT public.is_platform_admin() AS allowed'))[0].allowed,true)
    assert.equal((await read('SELECT * FROM users')).length,2)
    assert.equal((await read('SELECT * FROM funds')).length,1)
    const operation = db.query("SELECT public.platform_admin_moderate_user($1,'flag','MFA test')",[other])
    if (['operations','super_admin'].includes(role)) {
      await operation
      assert.equal((await read('SELECT * FROM platform_admin_audit_log WHERE actor_user_id=$1',[admin])).length>0,true)
    } else await assert.rejects(operation,/role is not authorized/)
  })
}

test('MFA does not authorize inactive administrators or ordinary users', async () => {
  await session('super_admin','aal2',false)
  assert.equal((await read('SELECT public.is_platform_admin() AS allowed'))[0].allowed,false)
  await assert.rejects(db.query("SELECT public.platform_admin_moderate_user($1,'flag','MFA test')",[other]),/administrator access required/)
  await session('super_admin','aal2',true,other)
  assert.equal((await read('SELECT public.is_platform_admin() AS allowed'))[0].allowed,false)
  assert.equal((await read('SELECT * FROM users')).length,1)
})

test('internal authorization helper remains inaccessible directly', async () => {
  await session('super_admin','aal2')
  await assert.rejects(db.query("SELECT public.require_platform_admin_operation('users.moderate')"),/permission denied/)
})


test('downgrading a verified session closes platform access again', async () => {
  await session('super_admin','aal2')
  assert.equal((await read('SELECT * FROM funds')).length,1)
  await session('super_admin','aal1')
  assert.equal((await read('SELECT * FROM funds')).length,0)
  assert.equal((await read('SELECT * FROM users')).length,1)
})


test('explicit profile grants preserve anonymous denial and restricted client writes', async () => {
  await db.exec('RESET ROLE')
  const grants = await read(`SELECT
    has_table_privilege('anon','public.users','SELECT') AS anonymous_read,
    has_table_privilege('authenticated','public.users','UPDATE') AS client_update,
    has_table_privilege('service_role','public.users','SELECT,INSERT,UPDATE,DELETE') AS server_access`)
  assert.equal(grants[0].anonymous_read,false)
  assert.equal(grants[0].client_update,false)
  assert.equal(grants[0].server_access,true)
})
