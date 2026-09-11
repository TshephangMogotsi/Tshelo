import { Alert } from 'react-native'
import * as WebBrowser from 'expo-web-browser'

export type LegalDocument = 'terms' | 'privacy'

export const TERMS_OF_SERVICE_URL = normalizeLegalUrl(
  process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL,
)
export const PRIVACY_POLICY_URL = normalizeLegalUrl(
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
)

export function normalizeLegalUrl(value: string | undefined): string | null {
  try {
    if (!value?.trim()) return null
    const url = new URL(value.trim())
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export async function openLegalDocument(document: LegalDocument): Promise<boolean> {
  const isTerms = document === 'terms'
  const title = isTerms ? 'Terms of Service' : 'Privacy Policy'
  const url = isTerms ? TERMS_OF_SERVICE_URL : PRIVACY_POLICY_URL

  if (!url) {
    Alert.alert(
      `${title} unavailable`,
      'This document has not been published yet. Please contact support@tshelo.co.bw.',
    )
    return false
  }

  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      dismissButtonStyle: 'close',
      controlsColor: '#7B2FFF',
      toolbarColor: '#F4F2EB',
      showTitle: true,
      enableBarCollapsing: false,
      enableDefaultShareMenuItem: false,
    })
  } catch {
    Alert.alert(`Could not open ${title}`, 'Please try again or contact Tshelo support.')
    return false
  }

  return true
}
