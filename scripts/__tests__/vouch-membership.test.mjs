import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('Vouch reads require joined membership for authors, recipients and other members', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`)
    const baseline = await readFile(new URL('../../supabase/migrations/20260707053236_baseline.sql', import.meta.url), 'utf8')
    for (const definition of baseline.match(/CREATE TYPE public\.\w+ AS ENUM \([^;]+;/g)) await db.exec(definition)
    for (const name of ['generate_fund_code','generate_fund_share_code']) {
      const definition = baseline.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(\\)[\\s\\S]*?\\$function\\$\\n;`))?.[0]
      assert.ok(definition)
      await db.exec(definition)
    }
    for (const table of ['users','funds','fund_members','member_vouches']) {
      const definition = baseline.match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0]
      assert.ok(definition)
      await db.exec(definition.replaceAll('uuid_generate_v4()','gen_random_uuid()'))
      await db.exec(`ALTER TABLE ${table} ADD PRIMARY KEY(id); ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT ALL ON ${table} TO anon,authenticated,service_role`)
    }
    const helper = baseline.match(/CREATE OR REPLACE FUNCTION public\.is_fund_member\(target_fund_id uuid\)[\s\S]*?\$function\$\n;/)?.[0]
    assert.ok(helper)
    await db.exec(helper)
    await db.exec('CREATE POLICY self_membership ON fund_members FOR SELECT TO authenticated USING(user_id=auth.uid())')
    const prior = await readFile(new URL('../../supabase/migrations/20261009110000_close_profile_receipt_and_membership_gaps.sql', import.meta.url),'utf8')
    const oldPolicy = prior.match(/CREATE POLICY vouches_select[^;]+;/)?.[0]
    assert.ok(oldPolicy)
    await db.exec(oldPolicy)
    const leaving = await readFile(new URL('../../supabase/migrations/20260812151000_leave_funds_and_events.sql', import.meta.url),'utf8')
    const leaveFunction = leaving.match(/CREATE OR REPLACE FUNCTION public\.leave_fund\(p_fund_id uuid\)[\s\S]*?\$\$;/)?.[0]
    assert.ok(leaveFunction)
    await db.exec(leaveFunction)
    await db.exec('REVOKE ALL ON FUNCTION public.leave_fund(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.leave_fund(uuid) TO authenticated,service_role')
    const checks = await readFile(new URL('../../supabase/tests/vouch_membership.sql', import.meta.url),'utf8')
    // Confirm this regression test detects the old personal-vouch exception.
    await assert.rejects(db.exec(checks), /Vouch membership regression/)
    await db.exec(await readFile(new URL('../../supabase/migrations/20261015230000_require_joined_membership_for_vouch_reads.sql', import.meta.url),'utf8'))
    const result = (await db.exec(checks)).at(-1).rows[0].evidence
    assert.equal(result.result,'PASS')
    assert.equal(result.relationship_status_cases,18)
    assert.equal(result.actual_leave_checks,2)
    assert.equal(result.fixtures_rolled_back,true)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n,0)
  } finally { await db.close() }
})
