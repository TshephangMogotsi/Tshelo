import {
  invitationContinuation,
  loginPathFor,
  onboardingPathFor,
  safePostLoginPath,
} from '../../admin/lib/post-login'
import { GET as getAppleAssociation } from '../../admin/app/.well-known/apple-app-site-association/route'
import { GET as getAndroidAssociation } from '../../admin/app/.well-known/assetlinks.json/route'

const ANDROID_FINGERPRINT = Array.from({ length: 32 }, (_, index) => index.toString(16).padStart(2, '0')).join(':').toUpperCase()

describe('post-login invitation continuation', () => {
  it('keeps account invitation destinations and their query string', () => {
    const destination = '/account/events?joinCode=EVT-A1B2C3D4'
    expect(safePostLoginPath(destination)).toBe(destination)
    expect(loginPathFor(destination)).toBe('/login?next=%2Faccount%2Fevents%3FjoinCode%3DEVT-A1B2C3D4')
    expect(invitationContinuation(destination)).toEqual({
      kind: 'event',
      code: 'EVT-A1B2C3D4',
      path: destination,
    })
    expect(onboardingPathFor(destination)).toBe('/onboarding?next=%2Faccount%2Fevents%3FjoinCode%3DEVT-A1B2C3D4')
  })

  it('recognises fund invitation continuations', () => {
    expect(invitationContinuation('/account/funds?joinCode=FUND-A1B2C3D4')).toMatchObject({
      kind: 'fund',
      code: 'FUND-A1B2C3D4',
    })
  })

  it.each([
    '/account/events',
    '/account/events?joinCode=short',
    '/account/events?joinCode=EVT-A1B2C3D4&next=https%3A%2F%2Fevil.example',
    '/account/events?joinCode=EVT-A1B2C3D4&joinCode=EVT-B1C2D3E4',
    '/account/overview?joinCode=EVT-A1B2C3D4',
  ])('does not enable invitation signup for a non-canonical destination: %s', value => {
    expect(invitationContinuation(value)).toBeNull()
  })

  it.each([
    'https://evil.example/account/events',
    '//evil.example/account/events',
    '/\\evil.example/account/events',
    '/funds',
    'javascript:alert(1)',
  ])('rejects unsafe or out-of-scope destinations: %s', value => {
    expect(safePostLoginPath(value)).toBeNull()
  })
})

describe('native invitation-link associations', () => {
  afterEach(() => {
    delete process.env.TSHELO_APPLE_TEAM_ID
    delete process.env.TSHELO_APPLE_APP_IDS
    delete process.env.TSHELO_ANDROID_SHA256_FINGERPRINTS
  })

  it('serves the iOS app ID and restricts it to invitation paths', async () => {
    process.env.TSHELO_APPLE_TEAM_ID = 'A1B2C3D4E5'
    const response = getAppleAssociation()

    await expect(response.json()).resolves.toEqual({
      applinks: {
        apps: [],
        details: [{
          appID: 'A1B2C3D4E5.com.datasentinels.tshelo',
          components: [{ '/': '/invite/*', comment: 'Tshelo event and fund invitations' }],
        }],
      },
    })
  })

  it('serves the Android package and configured signing fingerprints', async () => {
    process.env.TSHELO_ANDROID_SHA256_FINGERPRINTS = ANDROID_FINGERPRINT
    const response = getAndroidAssociation()

    await expect(response.json()).resolves.toEqual([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.digitalnatives.tshelo',
        sha256_cert_fingerprints: [ANDROID_FINGERPRINT],
      },
    }])
  })

  it('returns a non-cacheable service error until signing identifiers are configured', () => {
    const apple = getAppleAssociation()
    const android = getAndroidAssociation()

    expect(apple.status).toBe(503)
    expect(android.status).toBe(503)
    expect(apple.headers.get('cache-control')).toBe('no-store')
    expect(android.headers.get('x-tshelo-association-configured')).toBe('false')
  })
})
