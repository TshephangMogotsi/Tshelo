import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from './supabase'
import {
  FUND_PERMISSION_KEYS,
  type FundPermission,
} from './fundPermissions'

export async function loadMyFundPermissions(fundId: string): Promise<Set<FundPermission>> {
  const { data, error } = await supabase.rpc('get_my_fund_permissions', {
    p_fund_id: fundId,
  })
  if (error) throw error

  return new Set(
    (data ?? [])
      .map((row: { permission_key?: unknown }) => row.permission_key)
      .filter((key: unknown): key is FundPermission => (
        typeof key === 'string'
        && FUND_PERMISSION_KEYS.includes(key as FundPermission)
      )),
  )
}

export function useFundPermissions(fundId: string | null | undefined) {
  const [permissions, setPermissions] = useState<Set<FundPermission>>(new Set())
  const [loadedFundId, setLoadedFundId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    let active = true
    if (!fundId) {
      setPermissions(new Set())
      setLoadedFundId(null)
      setError(null)
      return () => { active = false }
    }

    setError(null)
    setPermissions(new Set())
    setLoadedFundId(null)
    loadMyFundPermissions(fundId)
      .then(next => {
        if (!active) return
        setPermissions(next)
        setLoadedFundId(fundId)
      })
      .catch(loadError => {
        if (!active) return
        setPermissions(new Set())
        setLoadedFundId(fundId)
        setError(loadError instanceof Error ? loadError.message : 'Permissions could not be loaded.')
      })

    return () => { active = false }
  }, [fundId]))

  const isLoading = Boolean(fundId && loadedFundId !== fundId)
  const can = useCallback(
    (permission: FundPermission) => permissions.has(permission),
    [permissions],
  )

  return { permissions, can, isLoading, error }
}
