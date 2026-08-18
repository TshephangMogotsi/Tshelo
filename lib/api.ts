import { createSupabaseTokenProvider, createTsheloApiClient } from '@shared/api-client'
import { requirePublicConfig } from './runtimeConfig'
import { supabase } from './supabase'

const apiBaseUrl = requirePublicConfig(
  'EXPO_PUBLIC_API_BASE_URL',
  process.env.EXPO_PUBLIC_API_BASE_URL,
)
const tokenProvider = createSupabaseTokenProvider(supabase.auth)

/** Shared typed API client for React Native and Expo web screens. */
export const api = createTsheloApiClient({
  baseUrl: apiBaseUrl,
  ...tokenProvider,
})
