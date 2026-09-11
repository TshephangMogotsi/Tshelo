import { normalizeLegalUrl } from '../legalDocuments'

const mockOpenBrowserAsync = jest.fn()
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: mockOpenBrowserAsync,
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
}))

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

describe('openLegalDocument', () => {
  const originalTermsUrl = process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL
  const originalPrivacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL = 'https://app.tshelo.com/legal/terms'
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = 'https://app.tshelo.com/legal/privacy'
    mockOpenBrowserAsync.mockResolvedValue({ type: 'cancel' })
  })

  afterAll(() => {
    if (originalTermsUrl === undefined) delete process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL
    else process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL = originalTermsUrl
    if (originalPrivacyUrl === undefined) delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL
    else process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = originalPrivacyUrl
  })

  it.each([
    ['terms', 'https://app.tshelo.com/legal/terms'],
    ['privacy', 'https://app.tshelo.com/legal/privacy'],
  ] as const)('opens %s inside the native browser presentation', async (document, url) => {
    const { openLegalDocument } = require('../legalDocuments') as typeof import('../legalDocuments')

    await expect(openLegalDocument(document)).resolves.toBe(true)
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(url, expect.objectContaining({
      presentationStyle: 'pageSheet',
      dismissButtonStyle: 'close',
      controlsColor: '#7B2FFF',
    }))
  })

  it('shows a safe retry message when the in-app browser cannot open', async () => {
    const { Alert } = require('react-native') as typeof import('react-native')
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockOpenBrowserAsync.mockRejectedValueOnce(new Error('Browser unavailable'))
    const { openLegalDocument } = require('../legalDocuments') as typeof import('../legalDocuments')

    await expect(openLegalDocument('terms')).resolves.toBe(false)
    expect(alert).toHaveBeenCalledWith(
      'Could not open Terms of Service',
      'Please try again or contact Tshelo support.',
    )
    alert.mockRestore()
  })
})
