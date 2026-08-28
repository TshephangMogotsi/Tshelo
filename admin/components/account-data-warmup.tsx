'use client'

import { useEffect } from 'react'
import { loadHomeSummary } from '@/lib/home-summary-cache'

export function AccountDataWarmup() {
  useEffect(() => {
    void loadHomeSummary().catch(() => {
      // Pages retain their own visible error and retry states.
    })
  }, [])

  return null
}
