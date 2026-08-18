'use client'

import { createSupabaseTokenProvider, createTsheloApiClient } from '@shared/api-client'
import { createClient } from './supabase-client'

let apiClient: ReturnType<typeof createTsheloApiClient> | undefined

/** Same-origin browser client for interactive admin components. Server
 * Components continue using the caller-scoped data services directly. */
export function createApiClient() {
  if (!apiClient) {
    if (typeof window === 'undefined') {
      throw new Error('The browser API client cannot be created during server rendering.')
    }
    const tokenProvider = createSupabaseTokenProvider(createClient().auth)
    apiClient = createTsheloApiClient({ baseUrl: window.location.origin, ...tokenProvider })
  }

  return apiClient
}
