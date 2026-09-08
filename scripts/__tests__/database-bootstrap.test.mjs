import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')
const support = '41c50f72-8da4-4aa3-8e3a-cafc5b7697fc'
const grantor = '00000000-0000-4000-8000-000000000001'
const grantSql = await migration('20260818132000_add_support_platform_admin.sql')

before(async () => {
  // Minimal unrelated application tables; execute the real platform-admin
  // schema and grant migration, including constraints and audit writes.
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
    CREATE TABLE public.users (id uuid PRIMARY KEY, deleted_at timestamptz, is_banned boolean DEFAULT false);
  `)
  for (const table of ['funds', 'events', 'support_tickets', 'disputes', 'fraud_signals', 'contributions', 'expenses', 'audit_log']) {
    await db.exec(`CREATE TABLE public.${table} (id uuid PRIMARY KEY)`)
  }
  await db.exec(await migration('20260814120000_platform_admin_console.sql'))
})

after(async () => db.close())

async function isolated(run) {
  await db.exec('BEGIN')
  try { await run() } finally { await db.exec('ROLLBACK') }
}

async function insertUser(id, extra = {}) {
  await db.query('INSERT INTO public.users (id, deleted_at, is_banned) VALUES ($1, $2, $3)',
    [id, extra.deletedAt ?? null, extra.banned ?? false])
}

test('fresh empty database replays without creating privileged users or grants', () => isolated(async () => {
  await db.exec(grantSql)
  for (const table of ['users', 'platform_admins', 'platform_admin_audit_log']) {
    assert.equal((await db.query(`SELECT count(*)::integer AS count FROM public.${table}`)).rows[0].count, 0)
  }
}))

test('populated database still rejects a missing target user', () => isolated(async () => {
  await insertUser(grantor)
  await assert.rejects(db.exec(grantSql), { code: 'P0002', message: 'Target support administrator user not found' })
}))

test('deleted target user remains ineligible', () => isolated(async () => {
  await insertUser(support, { deletedAt: '2026-01-01T00:00:00Z' })
  await assert.rejects(db.exec(grantSql), { code: 'P0002' })
}))

test('banned target user remains ineligible', () => isolated(async () => {
  await insertUser(support, { banned: true })
  await assert.rejects(db.exec(grantSql), { code: '23514' })
}))

test('an active super administrator is still required', () => isolated(async () => {
  await insertUser(support)
  await insertUser(grantor)
  await db.query("INSERT INTO public.platform_admins (user_id, role, is_active) VALUES ($1, 'super_admin', false)", [grantor])
  await assert.rejects(db.exec(grantSql), { code: '42501' })
}))

test('eligible existing user receives support-only access and an attributed audit entry', () => isolated(async () => {
  await insertUser(support)
  await insertUser(grantor)
  await db.query("INSERT INTO public.platform_admins (user_id, role) VALUES ($1, 'super_admin')", [grantor])
  await db.exec(grantSql)
  assert.deepEqual((await db.query('SELECT role, is_active, created_by FROM public.platform_admins WHERE user_id=$1', [support])).rows,
    [{ role: 'support', is_active: true, created_by: grantor }])
  const [audit] = (await db.query('SELECT actor_user_id, action, entity_id, metadata FROM public.platform_admin_audit_log')).rows
  assert.equal(audit.actor_user_id, grantor)
  assert.equal(audit.action, 'platform_admin.created')
  assert.equal(audit.entity_id, support)
  assert.deepEqual(audit.metadata, {
    old: null, new: { role: 'support', status: 'active' }, source: 'database_migration',
  })
}))

test('existing support membership is updated and audited without a duplicate grant', () => isolated(async () => {
  await insertUser(support)
  await insertUser(grantor)
  await db.query("INSERT INTO public.platform_admins (user_id, role) VALUES ($1, 'super_admin')", [grantor])
  await db.query("INSERT INTO public.platform_admins (user_id, role, is_active) VALUES ($1, 'support', false)", [support])
  await db.exec(grantSql)
  assert.deepEqual((await db.query('SELECT role, is_active FROM public.platform_admins WHERE user_id=$1', [support])).rows,
    [{ role: 'support', is_active: true }])
  const [audit] = (await db.query('SELECT action, metadata FROM public.platform_admin_audit_log')).rows
  assert.equal(audit.action, 'platform_admin.updated')
  assert.deepEqual(audit.metadata.old, { role: 'support', status: 'inactive' })
}))
