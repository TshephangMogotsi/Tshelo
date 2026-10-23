const origin = process.env.DEPLOYMENT_URL
const url = new URL(origin)
if (url.protocol !== 'https:' || url.origin !== origin || !url.hostname.endsWith('.vercel.app')) {
  throw new Error('Expected the staged Vercel HTTPS origin')
}
const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {}
for (const [path, status, contentType] of [['/login', 200, 'text/html'], ['/api/v1/users/me', 401, 'application/json']]) {
  const response = await fetch(`${origin}${path}`, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) })
  if (response.status !== status || !response.headers.get('content-type')?.includes(contentType)) {
    throw new Error(`Staged release smoke test failed for ${path} (${response.status})`)
  }
}
console.log('Staged login and unauthenticated API checks passed')
