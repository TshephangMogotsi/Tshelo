import assert from 'node:assert/strict'
import test from 'node:test'
import { ciSupabaseConfig, fixturePhone, invalidTotp, requireLocalUrl, totp, redactCredentials } from './support.mjs'

test('only the exact disposable loopback endpoint is accepted', () => {
  assert.equal(requireLocalUrl('http://127.0.0.1:54321', 54321), 'http://127.0.0.1:54321')
  for (const value of ['https://albihofmlafjzbusancu.supabase.co', 'http://127.0.0.1.attacker.test:54321',
    'http://user@127.0.0.1:54321', 'http://127.0.0.1:54321/path', 'http://127.0.0.1:54321?target=hosted',
    'https://127.0.0.1:54321', 'http://127.0.0.1:54322']) {
    assert.throws(() => requireLocalUrl(value, 54321))
  }
})

test('TOTP matches RFC 6238 SHA-1 vectors truncated to six digits', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
  for (const [seconds, expected] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037'],[20000000000,'353130']]) {
    assert.equal(totp(secret, seconds * 1000), expected)
  }
  assert.notEqual(invalidTotp(secret, 59000), totp(secret, 59000))
})

test('disposable config enables real TOTP and limits primary OTP fixtures to six synthetic numbers', () => {
  const config = ciSupabaseConfig()
  assert.ok(config.includes('project_id = "tshelo-mfa-ci"'))
  assert.ok(config.includes('[auth.mfa.totp]\nenroll_enabled = true\nverify_enabled = true'))
  assert.equal((config.match(/= "123456"/g) ?? []).length, 6)
  assert.equal(fixturePhone(1), '26770000001')
  assert.equal(fixturePhone(6), '26770000006')
})

test('startup failure diagnostics remove disposable credentials', () => {
  const log = 'migration failed; eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature sb_secret_example sb_publishable_example'
  assert.equal(redactCredentials(log), 'migration failed; [redacted JWT] [redacted key] [redacted key]')
})
