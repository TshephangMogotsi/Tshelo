export const TOKEN_PORTAL_URL = process.env.EXPO_PUBLIC_TOKEN_PORTAL_URL?.trim() ?? ''

export function buildTokenPortalUrl(baseUrl: string, packCode: string): string | null {
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:') return null
    url.searchParams.set('pack', packCode)
    url.searchParams.set('source', 'app')
    return url.toString()
  } catch {
    return null
  }
}
