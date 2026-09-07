const IOS_BUNDLE_ID = 'com.datasentinels.tshelo'

function configuredAppIds() {
  const explicitIds = process.env.TSHELO_APPLE_APP_IDS
    ?.split(',')
    .map((value: string) => value.trim())
    .filter((value: string) => /^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/.test(value)) ?? []
  if (explicitIds.length) return [...new Set(explicitIds)]

  const teamId = process.env.TSHELO_APPLE_TEAM_ID?.trim()
  return teamId && /^[A-Z0-9]{10}$/.test(teamId) ? [`${teamId}.${IOS_BUNDLE_ID}`] : []
}

export function GET() {
  const details = configuredAppIds().map(appID => ({
    appID,
    components: [{ '/': '/invite/*', comment: 'Tshelo event and fund invitations' }],
  }))
  const configured = details.length > 0

  return Response.json({ applinks: { apps: [], details } }, {
    status: configured ? 200 : 503,
    headers: {
      'Cache-Control': configured ? 'public, max-age=300, s-maxage=300' : 'no-store',
      'Content-Type': 'application/json',
      'X-Tshelo-Association-Configured': configured ? 'true' : 'false',
    },
  })
}
