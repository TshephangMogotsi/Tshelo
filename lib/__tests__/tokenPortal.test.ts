import { buildTokenPortalUrl } from '../tokenPortal'

describe('buildTokenPortalUrl', () => {
  it('builds an HTTPS checkout link without exposing account data', () => {
    expect(buildTokenPortalUrl('https://example.com/tokens', 'popular')).toBe(
      'https://example.com/tokens?pack=popular&source=app',
    )
  })

  it('rejects missing, malformed, and insecure checkout URLs', () => {
    expect(buildTokenPortalUrl('', 'starter')).toBeNull()
    expect(buildTokenPortalUrl('not-a-url', 'starter')).toBeNull()
    expect(buildTokenPortalUrl('http://example.com/tokens', 'starter')).toBeNull()
  })
})
