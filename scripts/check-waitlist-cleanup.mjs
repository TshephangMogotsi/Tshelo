import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Fail closed when the independent caller cannot reach the database, the
// monitor stops running, or the cleanup/monitor reports an incident.
export function waitlistHealthPasses(health) {
  return health?.fresh === true && health.monitor_scheduled === true
    && Array.isArray(health.issues) && health.issues.length === 0
    && health.open_incidents === 0
    && health.latest_monitor_run_status === 'succeeded'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const raw = execFileSync('supabase', ['db','query','--linked','--project-ref','albihofmlafjzbusancu',
      '--file',fileURLToPath(new URL('../supabase/monitoring/waitlist_cleanup_status.sql',import.meta.url)),
      '--output','json'], { encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000 })
    const result = JSON.parse(raw)
    const health = (Array.isArray(result) ? result : result.rows)?.[0]?.health
    if (!health || typeof health !== 'object') throw new Error('Invalid health response')
    console.log(JSON.stringify({ result:waitlistHealthPasses(health)?'PASS':'FAIL', ...health },null,2))
    if (!waitlistHealthPasses(health)) process.exitCode=1
  } catch {
    console.error('FAIL: Waitlist cleanup health could not be verified. Check Supabase access/connectivity and the operator runbook.')
    process.exitCode=1
  }
}
