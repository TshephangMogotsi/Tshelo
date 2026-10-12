import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const tables = ['mobile_money_verifications', 'sms_logs', 'promo_codes', 'app_config', 'notification_templates']
const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'

test('Phase 1 closes client writes/catalog reads while retaining owner reads and server access', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      CREATE TYPE payment_method AS ENUM ('orange_money');`)
    const baseline = await readFile(new URL('../../supabase/migrations/20260707053236_baseline.sql', import.meta.url), 'utf8')
    for (const table of tables) {
      // Exercise the real table shapes and legacy policies from the baseline.
      const definition = baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0]
      assert.ok(definition, `Missing baseline table ${table}`)
      await db.exec(definition.replaceAll('uuid_generate_v4()', 'gen_random_uuid()'))
      await db.exec(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
        GRANT ALL ON public.${table} TO anon, authenticated, service_role;`)
      for (const policy of baseline.split('\n').filter(line => line.startsWith('CREATE POLICY ') && line.includes(` ON public.${table} `))) {
        await db.exec(policy)
      }
    }
    await db.query(`INSERT INTO mobile_money_verifications (user_id,country_code,provider,phone_number,expected_reference,expected_currency)
      VALUES ($1,'BW','orange_money','26771234567','SERVER-REF','BWP'), ($2,'BW','orange_money','26774567890','OTHER-REF','BWP')`, [owner, other])
    await db.query('INSERT INTO sms_logs(user_id,raw_message) VALUES ($1,\'own\'), ($2,\'other\')', [owner, other])
    await db.exec(`INSERT INTO promo_codes(code,discount_type) VALUES ('PRIVATE','tokens');
      INSERT INTO notification_templates(template_code,title,body) VALUES ('welcome','Welcome','Hello');
      INSERT INTO app_config(key,value) VALUES ('app_version_latest','"1.0.0"'),
        ('maintenance_mode','false'), ('high_value_threshold_bwp','250000'), ('future_secret','"private"');
      GRANT INSERT (status), UPDATE (status) ON mobile_money_verifications TO authenticated;
      GRANT SELECT (body) ON notification_templates TO authenticated;`)
    await db.exec(await readFile(new URL('../../supabase/migrations/20261012120000_phase_one_client_table_hardening.sql', import.meta.url), 'utf8'))
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`)
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [role === 'authenticated' ? owner : ''])
      for (const table of tables) {
        await assert.rejects(db.query(`INSERT INTO ${table} DEFAULT VALUES`), /permission denied/)
        const column = table === 'app_config' ? 'value' : table === 'notification_templates' ? 'body' : table === 'promo_codes' ? 'code' : 'status'
        await assert.rejects(db.query(`UPDATE ${table} SET ${column}=${column}`), /permission denied/)
        await assert.rejects(db.query(`DELETE FROM ${table}`), /permission denied/)
        await assert.rejects(db.query(`TRUNCATE ${table}`), /permission denied/)
      }
      for (const table of ['promo_codes', 'notification_templates']) {
        await assert.rejects(db.query(`SELECT * FROM ${table}`), /permission denied/)
      }
      if (role === 'anon') {
        for (const table of ['mobile_money_verifications', 'sms_logs', 'app_config']) {
          await assert.rejects(db.query(`SELECT * FROM ${table}`), /permission denied/)
        }
      } else {
        for (const table of ['mobile_money_verifications', 'sms_logs']) {
          assert.deepEqual((await db.query(`SELECT user_id FROM ${table}`)).rows, [{ user_id: owner }])
        }
        assert.deepEqual((await db.query('SELECT key FROM app_config ORDER BY key')).rows,
          [{ key: 'app_version_latest' }, { key: 'maintenance_mode' }])
        await assert.rejects(db.query('SELECT * FROM app_config'), /permission denied/)
        await assert.rejects(db.query('SELECT description FROM app_config'), /permission denied/)
      }
      await db.exec('RESET ROLE')
    }
    await db.exec('SET ROLE service_role')
    for (const table of tables) {
      assert.ok((await db.query(`SELECT * FROM ${table}`)).rows.length > 0)
    }
    await db.query("UPDATE app_config SET value='true' WHERE key='maintenance_mode'")
    await db.query("INSERT INTO sms_logs(user_id,raw_message) VALUES ($1,'server-authored')", [owner])
    await db.query(`INSERT INTO mobile_money_verifications (user_id,country_code,provider,phone_number,expected_reference,expected_currency)
      VALUES ($1,'BW','orange_money','26771234567','SERVER-NEW','BWP')`, [owner])
  } finally {
    await db.close()
  }
})
