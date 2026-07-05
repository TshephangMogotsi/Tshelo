import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const url  = new URL(req.url)
  const code = url.searchParams.get('code')?.trim().toUpperCase()

  if (!code) return errorPage('Missing fund code.', 400)

  const { data: rows } = await supabase.rpc('find_fund_by_code', { p_code: code })
  const fund = rows?.[0] ?? null

  if (!fund) return errorPage('This invite link is invalid or the fund no longer exists.', 404)

  const { count } = await supabase
    .from('fund_members')
    .select('id', { count: 'exact', head: true })
    .eq('fund_id', fund.id)
    .not('status', 'in', '(left,removed,declined)')

  const memberCount = count ?? 0

  const symbol  = fund.currency_code === 'BWP' ? 'P' : fund.currency_code
  const goalStr = fund.goal_amount
    ? `${symbol} ${Number(fund.goal_amount).toLocaleString('en', { maximumFractionDigits: 0 })}`
    : null

  const ogTitle       = `Join "${fund.title}" on Tshelo`
  const ogDescription = [
    goalStr ? `Goal: ${goalStr}` : null,
    `${memberCount} member${memberCount !== 1 ? 's' : ''}`,
    `Organised by ${fund.organiser_name ?? 'Tshelo'}`,
  ].filter(Boolean).join(' · ')

  const pageUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fund-preview?code=${encodeURIComponent(code)}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${h(ogTitle)}</title>

  <meta property="og:type"        content="website" />
  <meta property="og:url"         content="${h(pageUrl)}" />
  <meta property="og:title"       content="${h(ogTitle)}" />
  <meta property="og:description" content="${h(ogDescription)}" />
  <meta property="og:site_name"   content="Tshelo" />

  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="${h(ogTitle)}" />
  <meta name="twitter:description" content="${h(ogDescription)}" />

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #0F0A1E;
      color: #ffffff;
      min-height: 100svh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1A1033;
      border: 1px solid rgba(118, 87, 240, 0.25);
      border-radius: 24px;
      padding: 40px 32px 36px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .wordmark {
      font-size: 28px;
      font-weight: 900;
      color: #7657F0;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }
    .wordmark-sub {
      font-size: 12px;
      color: rgba(255,255,255,0.35);
      letter-spacing: 0.3px;
      margin-bottom: 32px;
    }
    .divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 24px 0;
    }
    .fund-name {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.25;
      margin-bottom: 6px;
    }
    .organiser {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 24px;
    }
    .stats {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-bottom: 24px;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 800;
      color: #7657F0;
    }
    .stat-label {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-top: 3px;
    }
    .code-box {
      background: rgba(118, 87, 240, 0.1);
      border: 1px solid rgba(118, 87, 240, 0.25);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 28px;
    }
    .code-label {
      font-size: 10px;
      font-weight: 700;
      color: rgba(255,255,255,0.35);
      text-transform: uppercase;
      letter-spacing: 1.2px;
      margin-bottom: 8px;
    }
    .code-value {
      font-size: 24px;
      font-weight: 900;
      color: #7657F0;
      letter-spacing: 4px;
    }
    .cta {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      line-height: 1.6;
    }
    .cta strong {
      color: rgba(255,255,255,0.75);
      font-weight: 600;
    }
    .open-btn {
      display: block;
      background: #7657F0;
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 50px;
      padding: 14px 24px;
      margin-bottom: 20px;
      transition: opacity 0.15s;
    }
    .open-btn:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="card">
    <div class="wordmark">Tshelo</div>
    <div class="wordmark-sub">Community savings, transparently.</div>

    <div class="fund-name">${h(fund.title)}</div>
    <div class="organiser">Organised by ${h(fund.organiser_name ?? 'Unknown')}</div>

    <div class="stats">
      ${goalStr ? `<div>
        <div class="stat-value">${h(goalStr)}</div>
        <div class="stat-label">Goal</div>
      </div>` : ''}
      <div>
        <div class="stat-value">${memberCount}</div>
        <div class="stat-label">Members</div>
      </div>
    </div>

    <div class="code-box">
      <div class="code-label">Invite Code</div>
      <div class="code-value">${h(code)}</div>
    </div>

    <a class="open-btn" href="tshelo://join/${h(code)}">Open in Tshelo app</a>

    <div class="cta">
      Don't have the app? Download Tshelo and enter code <strong>${h(code)}</strong> to join.
    </div>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
})

function h(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
}

function errorPage(message: string, status: number): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <title>Tshelo</title>
    <style>body{font-family:sans-serif;background:#0F0A1E;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
    h2{color:#7657F0;margin-bottom:8px}p{color:rgba(255,255,255,.5);font-size:14px}</style>
    </head><body><div><h2>Tshelo</h2><p>${h(message)}</p></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
