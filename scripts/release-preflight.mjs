import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {}
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')]
      }),
  )
}

const fileEnv = parseEnv(path.join(root, '.env'))
const config = name => process.env[name]?.trim() || fileEnv[name]?.trim() || ''
const failures = []
const warnings = []

function requireValue(name) {
  const value = config(name)
  if (!value || /your-|example/i.test(value)) failures.push(`${name} is missing or still a placeholder`)
  return value
}

function requireHttps(name) {
  const value = requireValue(name)
  if (!value) return
  try {
    if (new URL(value).protocol !== 'https:') failures.push(`${name} must use HTTPS`)
  } catch {
    failures.push(`${name} must be a valid URL`)
  }
}

requireHttps('EXPO_PUBLIC_SUPABASE_URL')
requireValue('EXPO_PUBLIC_SUPABASE_ANON_KEY')
requireHttps('EXPO_PUBLIC_API_BASE_URL')
requireHttps('EXPO_PUBLIC_TERMS_OF_SERVICE_URL')
requireHttps('EXPO_PUBLIC_PRIVACY_POLICY_URL')

const checkoutUrl = config('EXPO_PUBLIC_TOKEN_PORTAL_URL')
if (!checkoutUrl) warnings.push('Token checkout is intentionally unavailable because EXPO_PUBLIC_TOKEN_PORTAL_URL is not set')
else requireHttps('EXPO_PUBLIC_TOKEN_PORTAL_URL')

const tokenScreen = fs.readFileSync(path.join(root, 'screens/main/TokenPurchaseScreen.tsx'), 'utf8')
if (/claim_beta_test_tokens|beta_test_tokens_100/.test(tokenScreen)) {
  failures.push('The client still references the retired beta-token grant')
}

const retirementMigration = path.join(
  root,
  'supabase/migrations/20260812180000_retire_beta_test_token_grant.sql',
)
if (!fs.existsSync(retirementMigration)) failures.push('The beta-token retirement migration is missing')

const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo
if (!appConfig.ios?.bundleIdentifier) failures.push('The iOS bundle identifier is missing')
if (!appConfig.android?.package) failures.push('The Android application ID is missing')

for (const warning of warnings) console.warn(`WARNING: ${warning}`)
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`)
  process.exitCode = 1
} else {
  console.log('Release configuration preflight passed.')
}
