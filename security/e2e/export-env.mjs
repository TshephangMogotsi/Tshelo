import { readFile, appendFile } from 'node:fs/promises'
import path from 'node:path'
import { requireLocalUrl } from './support.mjs'

if (process.env.CI !== 'true' || !process.env.GITHUB_ENV || !process.env.RUNNER_TEMP) {
  throw new Error('Environment export is restricted to CI.')
}
const status = JSON.parse(await readFile(path.join(process.env.RUNNER_TEMP, 'mfa-supabase.json'), 'utf8'))
const url = requireLocalUrl(status.API_URL, 54321)
const publicKey = status.ANON_KEY
const serviceKey = status.SERVICE_ROLE_KEY
if (!publicKey || !serviceKey || /[\r\n]/.test(publicKey + serviceKey)) throw new Error('Missing or invalid disposable-stack keys')
for (const value of [publicKey, serviceKey]) console.log(`::add-mask::${value}`)
const values = {
  MFA_TEST_SUPABASE_URL: url,
  MFA_TEST_PUBLIC_KEY: publicKey,
  MFA_TEST_SERVICE_KEY: serviceKey,
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
}
await appendFile(process.env.GITHUB_ENV, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''))
console.log('Configured app and tests for the disposable loopback stack.')
