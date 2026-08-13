export type MapsPlatform = 'ios' | 'android' | 'web'

function parseUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    return new URL(candidate)
  } catch {
    return null
  }
}

export function normalizeMapsUrl(value?: string | null) {
  if (!value) return null
  const url = parseUrl(value)
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null

  const host = url.hostname.toLowerCase()
  const path = url.pathname.toLowerCase()
  const isGoogleHost = /(^|\.)google\.[a-z.]+$/.test(host)
  const isGoogleMaps = (isGoogleHost && (host.startsWith('maps.') || path.startsWith('/maps')))
    || (host === 'maps.app.goo.gl')
    || (host === 'goo.gl' && path.startsWith('/maps'))
  const isAppleMaps = host === 'maps.apple.com'
  const isWaze = (host === 'waze.com' || host.endsWith('.waze.com'))
    && (path.startsWith('/ul') || path.startsWith('/live-map'))

  return isGoogleMaps || isAppleMaps || isWaze ? url.toString() : null
}

export function isMapsUrl(value?: string | null) {
  return normalizeMapsUrl(value) !== null
}

export function mapsSearchUrl(query: string, platform: MapsPlatform = 'web') {
  const trimmed = query.trim()
  if (!trimmed) {
    return platform === 'ios' ? 'https://maps.apple.com/' : 'https://www.google.com/maps'
  }

  const encodedQuery = encodeURIComponent(trimmed)
  return platform === 'ios'
    ? `https://maps.apple.com/?q=${encodedQuery}`
    : `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`
}
