import { spawnSync } from 'node:child_process'
import { redactCredentials } from './support.mjs'

const logs = spawnSync('docker', ['logs', 'supabase_auth_tshelo-mfa-ci'], { encoding: 'utf8' })
const output = `${logs.stdout ?? ''}\n${logs.stderr ?? ''}`
for (const line of output.split('\n')) {
  let entry
  try { entry = JSON.parse(line) } catch { continue }
  if (entry.level !== 'error' || !entry.error) continue
  // Emit only the server error, never request headers, sessions or factor data.
  console.error(redactCredentials(String(entry.error))
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]')
    .replace(/\b[A-Z2-7]{20,}\b/g, '[secret]')
    .replace(/\b\d{8,}\b/g, '[number]'))
}
