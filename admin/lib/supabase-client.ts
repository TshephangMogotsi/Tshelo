'use client'

import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseConfig } from './config'

let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (!browserClient) {
    const { url, key } = getSupabaseConfig()
    browserClient = createBrowserClient(url, key)
  }

  return browserClient
}
