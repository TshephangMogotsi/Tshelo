import 'server-only'

import { cache } from 'react'
import { getSupabaseConfig } from '@/lib/config'

export type PublicFundPreview = {
  code: string
  title: string
  organiserName: string
  goalAmount: number | string | null
  currencyCode: string
  memberCount: number
  status: string
  invitationUrl: string
  description: string
}

const FUND_CODE = /^FND-[A-Z0-9]{8,32}$/

export function normalizePublicFundCode(value: string) {
  const code = value.trim().toUpperCase()
  return FUND_CODE.test(code) ? code : null
}

export function normalizePreviewVersion(value: string | string[] | undefined) {
  const version = Array.isArray(value) ? value[0] : value
  return version && /^\d{10,12}$/.test(version) ? version : null
}

export const getPublicFundPreview = cache(async (rawCode: string, version?: string | null): Promise<PublicFundPreview | null> => {
  const code = normalizePublicFundCode(rawCode)
  if (!code) return null

  const { url } = getSupabaseConfig()
  const endpoint = new URL('/functions/v1/fund-preview', url)
  endpoint.searchParams.set('code', code)
  endpoint.searchParams.set('format', 'json')
  if (version) endpoint.searchParams.set('v', version)

  try {
    const response = await fetch(endpoint, { cache: 'no-store' })
    if (!response.ok) return null
    const preview = await response.json() as PublicFundPreview
    return preview.code === code ? preview : null
  } catch {
    return null
  }
})
