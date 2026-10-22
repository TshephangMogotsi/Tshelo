import { cp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ciSupabaseConfig } from './support.mjs'

if (process.env.CI !== 'true' || !process.env.RUNNER_TEMP) {
  throw new Error('Stack preparation is restricted to the disposable CI runner.')
}
const root = fileURLToPath(new URL('../../', import.meta.url))
const stack = path.join(process.env.RUNNER_TEMP, 'tshelo-mfa-stack')
await mkdir(path.join(stack, 'supabase'), { recursive: true })
await cp(path.join(root, 'supabase/migrations'), path.join(stack, 'supabase/migrations'), { recursive: true })
await writeFile(path.join(stack, 'supabase/config.toml'), ciSupabaseConfig())
console.log('Prepared isolated Supabase configuration and repository migrations.')
