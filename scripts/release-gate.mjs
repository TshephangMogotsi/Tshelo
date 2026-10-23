import { pathToFileURL } from 'node:url'

export function assertReleaseReady({ sha, head, runs, repository }) {
  if (!/^[a-f0-9]{40}$/.test(sha) || head !== sha) throw new Error('Release must use the current main commit')
  const candidates = runs.filter(run => run.head_sha === sha && run.head_branch === 'main'
    && run.event === 'push' && run.path === '.github/workflows/ci.yml'
    && run.repository?.full_name === repository)
  candidates.sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)
  if (candidates[0]?.status !== 'completed' || candidates[0]?.conclusion !== 'success') {
    throw new Error('The latest CI push run for this main commit must pass before release')
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY
  const sha = process.env.GITHUB_SHA
  if (!repository || !process.env.GH_TOKEN) throw new Error('GitHub release context is required')
  async function get(path) {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`Release gate API returned ${response.status}`)
    return response.json()
  }
  const [branch, workflow] = await Promise.all([
    get('branches/main'), get(`actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=100`),
  ])
  assertReleaseReady({ sha, head: branch.commit.sha, runs: workflow.workflow_runs, repository })
  console.log(`Release gate passed for ${sha}`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
