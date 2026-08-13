import { requirePublicConfig } from '../runtimeConfig'

describe('requirePublicConfig', () => {
  it('returns a trimmed configured value', () => {
    expect(requirePublicConfig('EXAMPLE', '  configured  ')).toBe('configured')
  })

  it.each([undefined, '', '   '])('rejects missing values without exposing a secret', value => {
    expect(() => requirePublicConfig('EXAMPLE', value)).toThrow(
      'Missing required public configuration: EXAMPLE',
    )
  })
})
