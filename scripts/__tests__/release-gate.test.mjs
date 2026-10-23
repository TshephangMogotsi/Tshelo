import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertReleaseReady } from '../release-gate.mjs'
const sha = 'a'.repeat(40)
const repository = 'owner/repo'
const run = { head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', repository: { full_name: repository }, run_number: 1, run_attempt: 1, status: 'completed', conclusion: 'success' }
const check = (runs, head = sha) => assertReleaseReady({ sha, head, runs, repository })
test('allows only a passing CI push for the exact current main commit', () => {
  assert.doesNotThrow(() => check([run]))
  for (const change of [{head_sha:'b'.repeat(40)}, {head_branch:'feature'}, {event:'pull_request'}, {path:'.github/workflows/other.yml'}, {repository:{full_name:'fork/repo'}}, {conclusion:'failure'}, {conclusion:'skipped'}, {status:'in_progress'}]) {
    assert.throws(() => check([{...run,...change}]))
  }
  assert.throws(() => check([], sha))
  assert.throws(() => check([run], 'b'.repeat(40)))
})
test('a newer failed or pending run cannot reuse an older passing result', () => {
  assert.throws(() => check([run, {...run,run_number:2,conclusion:'failure'}]))
  assert.throws(() => check([run, {...run,run_attempt:2,status:'in_progress'}]))
})
