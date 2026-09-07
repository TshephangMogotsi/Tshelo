import { buildTokenPortalUrl } from '../tokenPortal'

describe('buildTokenPortalUrl', () => {
  it('builds an HTTPS checkout link without exposing account data', () => {
    expect(buildTokenPortalUrl('https://example.com/tokens', 'top_up_60')).toBe(
      'https://example.com/tokens?pack=top_up_60&source=app',
    )
  })

  it('rejects missing, malformed, and insecure checkout URLs', () => {
    expect(buildTokenPortalUrl('', 'top_up_60')).toBeNull()
    expect(buildTokenPortalUrl('not-a-url', 'top_up_60')).toBeNull()
    expect(buildTokenPortalUrl('http://example.com/tokens', 'top_up_60')).toBeNull()
  })
})
