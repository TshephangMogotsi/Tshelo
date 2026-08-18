import { extractBearerJwt } from '../auth'

const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature_123'

describe('extractBearerJwt', () => {
  it('extracts a Supabase access token from a bearer header', () => {
    expect(extractBearerJwt(`Bearer ${jwt}`)).toBe(jwt)
    expect(extractBearerJwt(`bearer ${jwt}`)).toBe(jwt)
  })

  it.each([
    undefined,
    null,
    '',
    jwt,
    'Bearer',
    'Bearer ',
    'Basic credentials',
    'Bearer publishable-key',
    `Bearer ${jwt} extra`,
    `Bearer  ${jwt}`,
  ])('rejects a missing or malformed authorization header', header => {
    expect(extractBearerJwt(header)).toBeNull()
  })
})
