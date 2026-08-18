import { requirePublicConfig } from './runtimeConfig'

const supabaseUrl = requirePublicConfig(
  'EXPO_PUBLIC_SUPABASE_URL',
  process.env.EXPO_PUBLIC_SUPABASE_URL,
)

export function fundPreviewUrl(fundCode: string): string {
  return `${supabaseUrl}/functions/v1/fund-preview?code=${encodeURIComponent(fundCode)}`
}
