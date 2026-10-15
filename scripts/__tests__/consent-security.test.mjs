import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('Real consent migration logs explicit acceptance/channel changes and enforces withdrawal', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT coalesce(nullif(current_setting(''request.jwt.claim.sub'',true),''''),current_setting(''request.jwt.claims'',true)::jsonb->>''sub'')::uuid';
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
      CREATE TYPE payment_method AS ENUM ('orange_money'); CREATE TYPE trust_level AS ENUM ('new','verified');`)
    const baseline = await readFile(new URL('../../supabase/migrations/20260707053236_baseline.sql', import.meta.url), 'utf8')
    for (const table of ['users', 'consent_log']) {
      const definition = baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0]
      assert.ok(definition)
      await db.exec(definition.replaceAll('uuid_generate_v4()', 'gen_random_uuid()'))
      await db.exec(`ALTER TABLE ${table} ADD PRIMARY KEY(id); ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
        GRANT SELECT ON ${table} TO authenticated; CREATE POLICY own_read ON ${table} FOR SELECT TO authenticated USING (${table === 'users' ? 'id' : 'user_id'}=auth.uid());`)
    }
    await db.exec(`ALTER TABLE consent_log ADD FOREIGN KEY(user_id) REFERENCES users(id);
      CREATE POLICY consent_log_insert ON consent_log FOR INSERT TO public WITH CHECK(user_id=auth.uid());
      GRANT INSERT,UPDATE,DELETE ON consent_log TO anon,authenticated;
      CREATE POLICY own_update ON users FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
      GRANT UPDATE(name) ON users TO authenticated;`)
    await db.exec(await readFile(new URL('../../supabase/migrations/20261015220000_fix_consent_audit_and_withdrawal.sql', import.meta.url), 'utf8'))
    const results = await db.exec(await readFile(new URL('../../supabase/tests/consent_audit.sql', import.meta.url), 'utf8'))
    const evidence = results.at(-1).rows[0].evidence
    assert.equal(evidence.result, 'PASS')
    assert.equal(evidence.fixtures_rolled_back, true)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM consent_log')).rows[0].n, 0)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 0)
  } finally { await db.close() }
})
