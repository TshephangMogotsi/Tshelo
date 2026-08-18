import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { api } from './api'
import { runApiRead } from './apiScreen'
import type { FundPermission } from './fundPermissions'

export async function loadMyFundPermissions(fundId: string, signal?: AbortSignal): Promise<Set<FundPermission>> {
  const permissions = await runApiRead(call => api.funds.permissions(fundId, call), { signal })
  return new Set(permissions)
}

export function useFundPermissions(fundId: string | null | undefined) {
  const [permissions, setPermissions] = useState<Set<FundPermission>>(new Set())
  const [loadedFundId, setLoadedFundId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    if (!fundId) {
      setPermissions(new Set())
      setLoadedFundId(null)
      setError(null)
      return () => controller.abort()
    }

    setError(null)
    setPermissions(new Set())
    setLoadedFundId(null)
    loadMyFundPermissions(fundId, controller.signal)
      .then(next => {
        if (controller.signal.aborted) return
        setPermissions(next)
        setLoadedFundId(fundId)
      })
      .catch(loadError => {
        if (controller.signal.aborted) return
        setPermissions(new Set())
        setLoadedFundId(fundId)
        setError(loadError instanceof Error ? loadError.message : 'Permissions could not be loaded.')
      })

    return () => controller.abort()
  }, [fundId]))

  const isLoading = Boolean(fundId && loadedFundId !== fundId)
  const can = useCallback(
    (permission: FundPermission) => permissions.has(permission),
    [permissions],
  )

  return { permissions, can, isLoading, error }
}
