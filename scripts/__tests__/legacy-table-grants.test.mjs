import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const sql = await readFile(new URL('../../supabase/migrations/20261102110000_tighten_legacy_table_grants.sql', import.meta.url), 'utf8')
const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'

test('legacy ACL cleanup preserves supported flows, column limits, RLS and server access', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
      CREATE TABLE public.security_legacy_tables(table_oid oid PRIMARY KEY);
      ALTER TABLE public.security_legacy_tables ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.users(id uuid PRIMARY KEY,name text,email text,protected_balance int);
      CREATE TABLE public.read_only(id uuid,user_id uuid);
      CREATE TABLE public.ledger(id uuid,user_id uuid);
      CREATE TABLE public.blocked(id uuid);
      CREATE TABLE public.no_policy(id uuid);
      CREATE TABLE public.restrictive_only(id uuid);
      CREATE TABLE public.supported_all(id uuid,user_id uuid);
      CREATE TABLE public.no_existing_grant(id uuid);
      CREATE TABLE public.public_inherited(id uuid);
      CREATE TABLE public.public_column_inherited(id uuid,private text);
      CREATE TABLE public.countries(code text,name text,is_launch_country boolean,private_note text);
      CREATE POLICY users_read ON users FOR SELECT TO authenticated USING(id=auth.uid());
      CREATE POLICY users_edit ON users FOR UPDATE TO authenticated USING(id=auth.uid());
      CREATE POLICY own_read ON read_only FOR SELECT TO authenticated USING(user_id=auth.uid());
      CREATE POLICY ledger_read ON ledger FOR SELECT TO authenticated USING(user_id=auth.uid());
      CREATE POLICY blocked_read ON blocked FOR SELECT TO public USING(false);
      CREATE POLICY restrictive ON restrictive_only AS RESTRICTIVE FOR SELECT TO authenticated USING(true);
      CREATE POLICY owner_all ON supported_all FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
      CREATE POLICY public_read ON public_inherited FOR SELECT TO authenticated USING(true);
      CREATE POLICY public_column_read ON public_column_inherited FOR SELECT TO authenticated USING(true);
      CREATE POLICY unused_read ON no_existing_grant FOR SELECT TO authenticated USING(true);
      CREATE POLICY country_read ON countries FOR SELECT TO public USING(true);
      INSERT INTO users VALUES('${owner}','Owner','owner@example.test',100),('${other}','Other','other@example.test',200);
      INSERT INTO read_only VALUES(gen_random_uuid(),'${owner}'),(gen_random_uuid(),'${other}');
      INSERT INTO countries VALUES('KEN','Kenya',false,'private');
      CREATE FUNCTION public.create_ledger_entry() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$INSERT INTO public.ledger VALUES(gen_random_uuid(),auth.uid())$$;
      GRANT EXECUTE ON FUNCTION public.create_ledger_entry() TO authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;`)
    const tables = (await db.query("SELECT oid,relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'")).rows
    for (const t of tables) {
      await db.exec(`ALTER TABLE public.${t.relname} ENABLE ROW LEVEL SECURITY`)
      await db.exec(`GRANT ALL ON public.${t.relname} TO service_role`)
      if (!['security_legacy_tables','no_existing_grant','public_inherited','public_column_inherited'].includes(t.relname)) {
        await db.exec(`GRANT ALL ON public.${t.relname} TO anon,authenticated`)
      }
    }
    // Model restricted profile columns and inherited PUBLIC access separately.
    await db.exec(`REVOKE UPDATE ON users FROM authenticated;
      GRANT UPDATE(name,email) ON users TO authenticated;
      GRANT SELECT(id),UPDATE(id),REFERENCES(id) ON no_policy TO authenticated;
      REVOKE ALL ON public_inherited,public_column_inherited FROM service_role;
      GRANT SELECT ON public_inherited TO PUBLIC;
      GRANT SELECT(id) ON public_column_inherited TO PUBLIC;
      INSERT INTO security_legacy_tables SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`)
    await db.exec(sql)
    await db.exec('SET ROLE authenticated')
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner])
    assert.equal((await db.query('SELECT * FROM users')).rows.length,1)
    assert.equal((await db.query('SELECT * FROM read_only')).rows.length,1)
    await db.query("UPDATE users SET name='Edited' WHERE id=$1",[owner])
    await assert.rejects(db.query('UPDATE users SET protected_balance=0'),/permission denied/)
    for (const statement of ['INSERT INTO read_only DEFAULT VALUES','UPDATE read_only SET id=id','DELETE FROM read_only','TRUNCATE users','SELECT * FROM blocked','SELECT * FROM no_policy','SELECT * FROM restrictive_only','SELECT * FROM no_existing_grant','INSERT INTO ledger DEFAULT VALUES']) {
      await assert.rejects(db.exec(statement),/permission denied/)
    }
    await db.exec('SELECT public.create_ledger_entry()')
    assert.equal((await db.query('SELECT * FROM ledger')).rows.length,1)
    await db.query('INSERT INTO supported_all VALUES(gen_random_uuid(),$1)',[owner])
    await assert.rejects(db.query('INSERT INTO supported_all VALUES(gen_random_uuid(),$1)',[other]),/row-level security/)
    await db.exec('UPDATE supported_all SET id=id; DELETE FROM supported_all')
    await db.exec('SELECT * FROM public_inherited; SELECT id FROM public_column_inherited')
    await assert.rejects(db.exec('SELECT private FROM public_column_inherited'),/permission denied/)
    await db.exec('RESET ROLE; SET ROLE anon')
    assert.equal((await db.query('SELECT code,name FROM countries WHERE is_launch_country=false ORDER BY name')).rows[0].code,'KEN')
    for (const statement of ['SELECT * FROM users','SELECT * FROM countries','SELECT * FROM public_inherited','SELECT id FROM public_column_inherited','INSERT INTO countries DEFAULT VALUES','TRUNCATE countries']) {
      await assert.rejects(db.exec(statement),/permission denied/)
    }
    await db.exec('RESET ROLE; SET ROLE service_role')
    await db.exec('SELECT * FROM users; SELECT * FROM public_inherited; SELECT id FROM public_column_inherited; INSERT INTO no_policy DEFAULT VALUES; UPDATE no_policy SET id=id; DELETE FROM no_policy')
    await assert.rejects(db.exec('SELECT private FROM public_column_inherited'),/permission denied/)
    await db.exec('RESET ROLE')
    // No supported ACL was widened; PUBLIC no longer grants client access.
    assert.equal((await db.query("SELECT has_table_privilege('authenticated','no_existing_grant','SELECT') AS allowed")).rows[0].allowed,false)
    assert.equal((await db.query("SELECT has_table_privilege('anon','countries','SELECT') AS allowed")).rows[0].allowed,false)
    // The guard must catch regressions on formerly exempt legacy tables.
    for (const statement of ['GRANT DELETE ON read_only TO authenticated','GRANT TRUNCATE ON users TO authenticated','GRANT SELECT ON users TO anon','GRANT SELECT(private_note) ON countries TO anon','GRANT SELECT ON blocked TO authenticated']) {
      await db.exec('BEGIN')
      await db.exec(statement)
      await assert.rejects(db.exec('SELECT public.assert_application_table_security()'),/Unexpected|Grant without/)
      await db.exec('ROLLBACK')
    }
    await db.exec('SELECT public.assert_application_table_security()')
    await db.exec(await readFile(new URL('../../supabase/tests/legacy_table_privileges.sql', import.meta.url), 'utf8'))
    // Rerunning the cleanup is safe and retains the same limited country reads.
    await db.exec(sql)
    await db.exec('SET ROLE anon')
    await db.query('SELECT code,name FROM countries WHERE is_launch_country=false')
  } finally { await db.close() }
})

test('a missing RLS prerequisite rolls back every earlier ACL change', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE security_legacy_tables(table_oid oid PRIMARY KEY);
      ALTER TABLE security_legacy_tables ENABLE ROW LEVEL SECURITY;
      CREATE TABLE a_legacy(id integer);
      ALTER TABLE a_legacy ENABLE ROW LEVEL SECURITY;
      GRANT ALL ON a_legacy TO anon,authenticated;
      CREATE TABLE z_missing_rls(id integer);
      INSERT INTO security_legacy_tables SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r';`)
    await assert.rejects(db.exec(sql),/RLS missing on public.z_missing_rls/)
    await db.exec('ROLLBACK')
    assert.equal((await db.query("SELECT has_table_privilege('anon','a_legacy','SELECT') AS allowed")).rows[0].allowed,true)
    assert.equal((await db.query("SELECT has_table_privilege('authenticated','a_legacy','TRUNCATE') AS allowed")).rows[0].allowed,true)
  } finally { await db.close() }
})
