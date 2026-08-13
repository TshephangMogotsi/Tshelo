import { normalizeLegalUrl } from '../legalDocuments'

describe('normalizeLegalUrl', () => {
  it('accepts and normalizes public HTTPS document URLs', () => {
    expect(normalizeLegalUrl('  https://tshelo.co.bw/privacy  ')).toBe(
      'https://tshelo.co.bw/privacy',
    )
  })

  it.each([undefined, '', 'not-a-url', 'http://tshelo.co.bw/privacy']) (
    'rejects missing, malformed, and insecure URLs',
    value => {
      expect(normalizeLegalUrl(value)).toBeNull()
    },
  )
})
