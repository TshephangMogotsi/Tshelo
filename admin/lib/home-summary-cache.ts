'use client'

import type { HomeSummary } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { runApiRead } from '@/lib/api-ui'

const CACHE_TTL_MS = 5 * 60_000

let cachedSummary: HomeSummary | null = null
let cachedAt = 0
let pendingSummary: Promise<HomeSummary> | null = null

export function invalidateHomeSummary() {
  cachedSummary = null
  cachedAt = 0
}

export function loadHomeSummary() {
  if (cachedSummary && Date.now() - cachedAt < CACHE_TTL_MS) {
    return Promise.resolve(cachedSummary)
  }
  if (pendingSummary) return pendingSummary

  pendingSummary = runApiRead(call => createApiClient().home.summary(call))
    .then(summary => {
      cachedSummary = summary
      cachedAt = Date.now()
      return summary
    })
    .finally(() => {
      pendingSummary = null
    })

  return pendingSummary
}
