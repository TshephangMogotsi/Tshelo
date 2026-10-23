import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { redactCredentials } from './support.mjs'

const log = await readFile(path.join(process.env.RUNNER_TEMP, 'mfa-supabase-start.log'), 'utf8')
console.error(redactCredentials(log).slice(-16000))
