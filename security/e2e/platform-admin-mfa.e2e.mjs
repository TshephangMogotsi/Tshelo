import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'node:fs/promises'
import { fixturePhone, invalidTotp, requireLocalUrl, totp, redactCredentials } from './support.mjs'

const url = requireLocalUrl(process.env.MFA_TEST_SUPABASE_URL, 54321)
const publicKey = process.env.MFA_TEST_PUBLIC_KEY
const serviceKey = process.env.MFA_TEST_SERVICE_KEY
if (!publicKey || !serviceKey) throw new Error('Disposable Supabase credentials are missing.')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const operator = createClient(url, serviceKey, options)
test.describe.configure({ mode: 'serial' })
const roles = ['support', 'operations', 'finance', 'super_admin']
const fixtures = []
const evidence = []
const results = []

// Never include provider error objects, tokens, setup keys or OTPs in failures.
function must(condition, message) { if (!condition) throw new Error(message) }
function caller(token) { return createClient(url, publicKey, { ...options, accessToken: async () => token }) }
function aal(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).aal
}
function record(role, check) { evidence.push({ role, check, result: 'pass' }) }

async function api(page, token, path, body) {
  try {
    return await page.request.fetch(`/api/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}` },
      ...(body ? { data: body } : {}),
    })
  } catch {
    throw new Error('Local API request failed before a response was received')
  }
}

async function primaryLogin(page, index) {
  await page.goto('/login')
  await page.getByLabel('Phone number', { exact: true }).fill(fixturePhone(index).slice(3))
  await page.getByRole('button', { name: 'Send secure code', exact: true }).click()
  await page.getByLabel('Verification code', { exact: true }).fill('123456')
  const response = page.waitForResponse(response => response.url() === `${url}/auth/v1/verify` && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Continue to dashboard', exact: true }).click()
  const verified = await response
  must(verified.ok(), 'Primary OTP verification failed')
  const body = await verified.json()
  must(typeof body.access_token === 'string' && aal(body.access_token) === 'aal1', 'Primary login did not produce aal1')
  return body.access_token
}

async function submitMfa(page, secret) {
  const response = page.waitForResponse(response => /\/auth\/v1\/factors\/[^/]+\/verify$/.test(response.url()) && response.ok())
  await page.getByLabel('Authenticator code', { exact: true }).fill(totp(secret))
  await page.getByRole('button', { name: 'Verify and continue', exact: true }).click()
  const verified = await (await response).json()
  must(typeof verified.access_token === 'string' && aal(verified.access_token) === 'aal2', 'Authenticator verification did not produce aal2')
  await expect(page).toHaveURL('http://127.0.0.1:3100/')
  return verified.access_token
}

test.beforeAll(async () => {
  // Unique phone numbers avoid the application's public.users phone constraint.
  for (let index = 1; index <= 6; index++) {
    const { data, error } = await operator.auth.admin.createUser({
      phone: fixturePhone(index), phone_confirm: true,
      user_metadata: { name: `Disposable MFA CI ${index}` },
      app_metadata: { synthetic_mfa_ci: true },
    })
    must(!error && data.user, `Could not create disposable MFA fixture ${index}`)
    const id = data.user.id
    fixtures.push({ id, index })
    const profile = await operator.from('users').upsert({
      id, phone: fixturePhone(index), name: `Disposable MFA CI ${index}`, profile_completed: true,
      onboarding_completed: true, notifications_enabled: false,
    }, { onConflict: 'id' }).select('id').single()
    must(!profile.error && profile.data?.id === id, `Could not prepare disposable profile ${index} (${profile.error?.code ?? 'missing row'}: ${redactCredentials(profile.error?.message ?? 'no profile returned')})`)
    if (index <= roles.length) {
      const grant = await operator.from('platform_admins').insert({ user_id: id, role: roles[index - 1], is_active: true })
      must(!grant.error, `Could not prepare disposable role ${index}`)
    }
  }
})

test.afterEach(async ({}, info) => { results.push({ scenario: info.title, status: info.status }) })

test.afterAll(async () => {
  // The entire stack is destroyed by CI even if setup or this cleanup fails.
  let cleanupPassed = true
  for (const fixture of fixtures) {
    const removed = await operator.from('platform_admins').delete().eq('user_id', fixture.id)
    cleanupPassed = cleanupPassed && !removed.error
    const banned = await operator.auth.admin.updateUserById(fixture.id, { ban_duration: '876000h' })
    cleanupPassed = cleanupPassed && !banned.error
  }
  await writeFile(new URL('./mfa-e2e-evidence.json', import.meta.url), JSON.stringify({
    source: process.env.GITHUB_SHA ?? 'local', runId: process.env.GITHUB_RUN_ID ?? null,
    environment: 'disposable-loopback-supabase',
    primaryLogin: 'synthetic phone OTP supplied by local Supabase test_otp configuration; no SMS delivery',
    secondFactor: 'real Supabase TOTP enrollment and verification; codes calculated from the UI setup key',
    recovery: 'not exercised; ownership and production procedure pending',
    cleanupPassed, results, evidence,
  }, null, 2))
  must(cleanupPassed, 'Disposable fixture access cleanup failed')
})

for (const [index, role] of roles.entries()) {
  test(`${role}: browser enrollment, API and database MFA enforcement`, async ({ page }) => {
    const subject = fixtures[index]
    const target = fixtures[4]
    const primaryToken = await primaryLogin(page, index + 1)
    await expect(page).toHaveURL(/\/mfa$/)
    await page.goto('/users')
    await expect(page).toHaveURL(/\/mfa$/)
    must((await api(page, primaryToken, 'admin/audit')).status() === 403, 'aal1 admin API read was not denied')
    const mutation = { user_id: target.id, action: 'flag', reason: 'Disposable MFA CI fixture' }
    must((await api(page, primaryToken, 'admin/users/moderate', mutation)).status() === 403, 'aal1 admin API mutation was not denied')
    must((await api(page, primaryToken, 'users/me')).status() === 200, 'MFA gate broke ordinary own-profile access')
    const low = caller(primaryToken)
    const read = await low.rpc('is_platform_admin')
    must(!read.error && read.data === false, 'Database accepted aal1 platform privileges')
    const audit = await low.from('platform_admin_audit_log').select('id')
    must(!audit.error && audit.data.length === 0, 'aal1 exposed platform audit rows')
    for (const [rpc, args] of [
      ['platform_admin_moderate_user', { p_user_id: target.id, p_action: 'flag', p_reason: 'Disposable MFA CI' }],
      ['platform_admin_update_support_ticket', { p_ticket_id: target.id, p_patch: {} }],
      ['platform_admin_moderate_fund', { p_fund_id: target.id, p_action: 'close', p_reason: 'Disposable MFA CI' }],
      ['platform_admin_upsert', { p_user_id: target.id, p_role: 'support', p_status: 'active' }],
    ]) {
      const result = await low.rpc(rpc, args)
      must(result.error?.code === '42501' && result.error.message.includes('Multi-factor verification required'), `aal1 ${rpc} did not enforce MFA`)
    }
    record(role, 'aal1 blocked at page, API read/write, RLS and four direct admin RPCs; own-profile access retained')

    await page.getByRole('button', { name: 'Set up authenticator', exact: true }).click()
    const key = page.locator('details code')
    await expect(key).toBeAttached()
    const secret = await key.textContent()
    must(typeof secret === 'string' && /^[A-Z2-7]+=*$/i.test(secret), 'Authenticator setup key was unavailable')
    await expect(page.getByAltText('Authenticator enrollment QR code')).toBeVisible()
    await page.getByLabel('Authenticator code', { exact: true }).fill(invalidTotp(secret))
    await page.getByRole('button', { name: 'Verify and continue', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Verification failed')
    must((await api(page, primaryToken, 'admin/audit')).status() === 403, 'Invalid authenticator code unlocked admin API')
    record(role, 'incorrect authenticator code denied')

    let verifiedToken = await submitMfa(page, secret)
    const verifiedCounter = Math.floor(Date.now() / 30000)
    must((await api(page, verifiedToken, 'admin/audit')).status() === 200, 'aal2 admin API read failed')
    const high = caller(verifiedToken)
    const allowed = await high.rpc('is_platform_admin')
    must(!allowed.error && allowed.data === true, 'Database did not accept verified platform role')
    const canModerate = ['operations', 'super_admin'].includes(role)
    must((await api(page, verifiedToken, 'admin/users/moderate', mutation)).status() === (canModerate ? 200 : 403), 'Verified API did not preserve role restrictions')
    const direct = await high.rpc('platform_admin_moderate_user', { p_user_id: target.id, p_action: 'unflag', p_reason: 'Disposable MFA CI' })
    must(canModerate ? !direct.error : direct.error?.code === '42501', 'Verified database RPC did not preserve role restrictions')
    if (canModerate) {
      const auditRows = await high.from('platform_admin_audit_log').select('actor_user_id').eq('actor_user_id', subject.id).eq('entity_id', target.id)
      must(!auditRows.error && auditRows.data.length >= 2, 'Verified mutations did not retain attributed audit records')
    }
    record(role, 'real aal2 JWT unlocked platform reads and preserved API/database role matrix and mutation audit')

    if (role === 'support') {
      await page.getByRole('button', { name: /sign out/i }).click()
      await expect(page).toHaveURL(/\/login$/)
      const secondPrimary = await primaryLogin(page, index + 1)
      await expect(page).toHaveURL(/\/mfa$/)
      await expect(page.getByRole('button', { name: 'Set up authenticator', exact: true })).toHaveCount(0)
      must((await api(page, secondPrimary, 'admin/audit')).status() === 403, 'Repeat primary login bypassed MFA')
      // Supabase rejects reuse of an accepted TOTP in the same time step.
      if (Math.floor(Date.now() / 30000) <= verifiedCounter) {
        await new Promise(resolve => setTimeout(resolve, (verifiedCounter + 1) * 30000 - Date.now() + 1100))
      }
      verifiedToken = await submitMfa(page, secret)
      record(role, 'sign-out and repeat OTP login required existing-factor challenge without re-enrollment')
    }

    const disabled = await operator.from('platform_admins').update({ is_active: false }).eq('user_id', subject.id)
    must(!disabled.error, 'Could not disable disposable admin')
    must((await api(page, verifiedToken, 'admin/audit')).status() === 403, 'Inactive admin retained API privileges')
    const inactive = await caller(verifiedToken).rpc('is_platform_admin')
    must(!inactive.error && inactive.data === false, 'Inactive admin retained database privileges')
    await page.goto('/users')
    await expect(page).toHaveURL(/\/unauthorized$/)
    record(role, 'role deactivation revoked page/API/database privileges even with aal2')
  })
}

test('ordinary app user retains account access and cannot open administrator MFA', async ({ page }) => {
  const token = await primaryLogin(page, 6)
  await expect(page).toHaveURL(/\/account\/overview$/)
  must((await api(page, token, 'users/me')).status() === 200, 'Ordinary own-profile access failed')
  must((await api(page, token, 'admin/audit')).status() === 403, 'Ordinary user gained admin API access')
  await page.goto('/mfa')
  await expect(page).toHaveURL(/\/unauthorized$/)
  record('ordinary-user', 'account access retained; admin API and administrator MFA page denied')
})
