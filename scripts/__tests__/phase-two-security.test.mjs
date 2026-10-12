import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('Phase 2 membership, future-table defaults and waitlist controls', async () => {
  const db = new PGlite()
  const ids = Array.from({length:8},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`)
  const [owner, member, pending, former, outsider, org, group, otherGroup] = ids
  const baseline = await readFile(new URL('../../supabase/migrations/20260707053236_baseline.sql',import.meta.url),'utf8')
  const tables=['organizations','organization_members','organization_payouts','recurring_groups','recurring_group_members','recurring_rounds','countries','country_waitlist']
  const asClient = async id => {
    await db.exec('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id])
    await db.exec('SET ROLE authenticated')
  }
  const asServer = async () => {
    await db.exec('RESET ROLE')
    await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false); SET ROLE service_role")
  }
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_admin;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS 'SELECT current_setting(''request.jwt.claim.role'',true)';
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
      CREATE TYPE member_status AS ENUM ('pending','joined','declined','removed','left');
      CREATE TYPE payment_method AS ENUM ('cash');`)
    for(const table of tables) {
      const definition=baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0]
      assert.ok(definition)
      await db.exec(definition.replaceAll('uuid_generate_v4()','gen_random_uuid()'))
      await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT ALL ON ${table} TO anon,authenticated,service_role`)
    }
    for(const table of tables) for(const policy of baseline.match(/CREATE POLICY [\s\S]*?;/g).filter(p=>p.includes(` ON public.${table} `))) await db.exec(policy)
    await db.exec('ALTER TABLE country_waitlist ADD PRIMARY KEY(id)')
    await db.query("INSERT INTO organizations(id,name,type) VALUES ($1,'Org','partner')",[org])
    for(const [id,role,active] of [[owner,'owner',true],[member,'member',true],[pending,'pending',false],[former,'member',false]]) {
      await db.query('INSERT INTO organization_members(organization_id,user_id,role,is_active) VALUES ($1,$2,$3,$4)',[org,id,role,active])
    }
    await db.query("INSERT INTO organization_payouts(organization_id,period_start,period_end,gross_amount,commission_rate,commission_amount) VALUES ($1,current_date,current_date,1,0,0)",[org])
    for(const [g,o] of [[group,owner],[otherGroup,outsider]]) await db.query("INSERT INTO recurring_groups(id,owner_id,group_code,name,contribution_amount,currency_code,frequency,payout_order) VALUES ($1,$2,'CODE','Group',1,'BWP','monthly','fixed')",[g,o])
    for(const [id,status] of [[member,'joined'],[pending,'pending'],[former,'left']]) await db.query('INSERT INTO recurring_group_members(group_id,user_id,status) VALUES ($1,$2,$3)',[group,id,status])
    await db.query('INSERT INTO recurring_rounds(group_id,round_number,due_date) VALUES ($1,1,current_date)',[group])
    await db.exec(`INSERT INTO countries(code,name,currency_code,currency_name,currency_symbol,phone_prefix,phone_length,is_launch_country)
      VALUES ('KEN','Kenya','KES','Shilling','KSh','+254',9,false),('BWA','Botswana','BWP','Pula','P','+267',8,true)`)
    await db.exec(await readFile(new URL('../../supabase/migrations/20261012140000_nonrecursive_membership_policies.sql',import.meta.url),'utf8'))
    for(const id of [owner,member,pending,former,outsider]) {
      await asClient(id)
      const canRead=[owner,member].includes(id)
      for(const table of ['organizations','organization_members','organization_payouts']) assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length>0,canRead)
      assert.equal((await db.query('SELECT * FROM recurring_groups WHERE id=$1',[group])).rows.length,canRead?1:0)
      assert.equal((await db.query('SELECT * FROM recurring_group_members WHERE group_id=$1',[group])).rows.length>0,canRead)
      assert.equal((await db.query('SELECT * FROM recurring_rounds WHERE group_id=$1',[group])).rows.length>0,canRead)
      if(id!==owner) await assert.rejects(db.query('INSERT INTO recurring_group_members(group_id,user_id) VALUES ($1,$2)',[group,outsider]),/row-level security/)
    }
    await asClient(owner)
    await db.query('INSERT INTO recurring_group_members(group_id,user_id) VALUES ($1,$2)',[group,outsider])
    await assert.rejects(db.query('INSERT INTO recurring_group_members(group_id,user_id) VALUES ($1,$2)',[otherGroup,owner]),/row-level security/)
    await db.exec('RESET ROLE; SET ROLE anon')
    assert.equal((await db.query('SELECT * FROM organizations')).rows.length,0)
    assert.equal((await db.query('SELECT * FROM recurring_groups')).rows.length,0)
    await assert.rejects(db.query('SELECT is_recurring_group_member($1)',[group]),/permission denied/)
    await db.exec('RESET ROLE')
    await db.query('UPDATE organization_members SET is_active=false WHERE user_id=$1',[member])
    await db.query("UPDATE recurring_group_members SET status='removed' WHERE user_id=$1",[member])
    await asClient(member)
    assert.equal((await db.query('SELECT * FROM organizations')).rows.length,0)
    assert.equal((await db.query('SELECT * FROM recurring_groups WHERE id=$1',[group])).rows.length,0)
    await db.exec(`RESET ROLE; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT SELECT ON TABLES TO anon;`)
    await db.exec(await readFile(new URL('../../supabase/migrations/20261012150000_restrict_future_table_defaults.sql',import.meta.url),'utf8'))
    await db.exec('CREATE TABLE public.security_probe(id int)')
    assert.equal((await db.query("SELECT has_table_privilege('anon','security_probe','SELECT') AS allowed")).rows[0].allowed,false)
    await assert.rejects(db.query('SELECT assert_application_table_security()'),/RLS missing/)
    await db.exec('ALTER TABLE security_probe ENABLE ROW LEVEL SECURITY; GRANT SELECT ON security_probe TO authenticated')
    await assert.rejects(db.query('SELECT assert_application_table_security()'),/Grant without matching/)
    await db.exec('CREATE POLICY probe_read ON security_probe FOR SELECT TO authenticated USING (false)')
    await db.query('SELECT assert_application_table_security()')
    await db.exec('GRANT TRUNCATE ON security_probe TO anon')
    await assert.rejects(db.query('SELECT assert_application_table_security()'),/Unexpected structural/)
    await db.exec('DROP TABLE security_probe')
    await db.exec(await readFile(new URL('../../supabase/migrations/20261012160000_country_waitlist_submission_controls.sql',import.meta.url),'utf8'))
    for(const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`)
      await assert.rejects(db.query('INSERT INTO country_waitlist(country_code,email) VALUES (\'KEN\',\'a@example.test\')'),/permission denied/)
      await assert.rejects(db.query('SELECT * FROM country_waitlist'),/permission denied/)
      await assert.rejects(db.query("SELECT submit_country_waitlist('KEN','a@example.test',NULL)"),/permission denied/)
      await db.exec('RESET ROLE')
    }
    await asServer()
    for(const args of [['BAD','a@example.test',null],['BWA','a@example.test',null],['KEN','bad',null],['KEN',null,'+26771234567'],['KEN',null,null]]) {
      await assert.rejects(db.query('SELECT submit_country_waitlist($1,$2,$3)',args),/WAITLIST_INVALID/)
    }
    await db.query("SELECT submit_country_waitlist('ken',' Test@Example.test ', '+254712345678')")
    await db.query("SELECT submit_country_waitlist('KEN','test@example.test',NULL)")
    assert.equal((await db.query('SELECT * FROM country_waitlist')).rows.length,1)
    assert.equal((await db.query('SELECT email FROM country_waitlist')).rows[0].email,'test@example.test')
    for(let i=0;i<4;i++) assert.equal((await db.query('SELECT consume_country_waitlist_limits($1,$2) AS allowed',['a'.repeat(64),['b'.repeat(64)]])).rows[0].allowed,i<3)
    for(let i=0;i<11;i++) assert.equal((await db.query('SELECT consume_country_waitlist_limits($1,$2) AS allowed',['c'.repeat(64),[(i+1).toString(16).padStart(64,'0')]])).rows[0].allowed,i<10)
    await db.query("UPDATE country_waitlist SET expires_at=now()-interval '1 day'")
    await db.query('SELECT purge_expired_country_waitlist()')
    assert.equal((await db.query('SELECT * FROM country_waitlist')).rows.length,0)
    await db.exec("UPDATE country_waitlist_rate_limits SET expires_at=now()-interval '1 day'")
    assert.equal((await db.query('SELECT consume_country_waitlist_limits($1,$2) AS allowed',['a'.repeat(64),['b'.repeat(64)]])).rows[0].allowed,true)
  } finally { await db.close() }
})
