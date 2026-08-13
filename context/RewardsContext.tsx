import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { hapticSuccess } from '../lib/haptics'
import RewardSnackbar, { RewardSnackbarItem } from '../components/RewardSnackbar'

type RewardRow = {
  id: string
  trust_points_awarded: number
  reward_definitions: {
    name: string
    description: string
    icon_name: string
  } | Array<{
    name: string
    description: string
    icon_name: string
  }> | null
}

function toSnackbarItem(row: RewardRow): RewardSnackbarItem | null {
  const joined = Array.isArray(row.reward_definitions)
    ? row.reward_definitions[0]
    : row.reward_definitions
  if (!joined) return null
  return {
    id: row.id,
    name: joined.name,
    description: joined.description,
    points: row.trust_points_awarded ?? 0,
    iconName: joined.icon_name,
  }
}

export function RewardsProvider({
  children,
  onOpenRewards,
}: {
  children: ReactNode
  onOpenRewards: () => void
}) {
  const { isAuthenticated, profileCompleted, userId, refreshProfile } = useAuth()
  const [queue, setQueue] = useState<RewardSnackbarItem[]>([])
  const [current, setCurrent] = useState<RewardSnackbarItem | null>(null)
  const knownIds = useRef(new Set<string>())
  const isClaimingReward = useRef(false)

  const enqueueReward = useCallback((item: RewardSnackbarItem | null) => {
    if (!item || knownIds.current.has(item.id)) return
    knownIds.current.add(item.id)
    setQueue(previous => [...previous, item])
  }, [])

  const loadReward = useCallback(async (rewardId: string) => {
    const { data } = await supabase
      .from('user_rewards')
      .select(`
        id,
        trust_points_awarded,
        reward_definitions!inner(name, description, icon_name)
      `)
      .eq('id', rewardId)
      .maybeSingle()
    if (data) enqueueReward(toSnackbarItem(data as RewardRow))
  }, [enqueueReward])

  useEffect(() => {
    if (!isAuthenticated || !profileCompleted || !userId) {
      setQueue([])
      setCurrent(null)
      knownIds.current.clear()
      isClaimingReward.current = false
      return
    }

    let active = true
    const channel = supabase
      .channel(`user-rewards-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_rewards', filter: `user_id=eq.${userId}` },
        payload => {
          if (active && typeof payload.new?.id === 'string') void loadReward(payload.new.id)
        },
      )
      .subscribe()

    async function initialiseRewards() {
      // This safely backfills achievements earned before the reward system was
      // introduced and catches aggregate thresholds after offline activity.
      await supabase.rpc('evaluate_my_rewards')
      if (!active) return

      const { data } = await supabase
        .from('user_rewards')
        .select(`
          id,
          trust_points_awarded,
          reward_definitions!inner(name, description, icon_name)
        `)
        .eq('user_id', userId)
        .is('snackbar_seen_at', null)
        .order('earned_at', { ascending: true })

      if (!active) return
      for (const row of data ?? []) enqueueReward(toSnackbarItem(row as RewardRow))
      await refreshProfile()
    }

    void initialiseRewards()
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [enqueueReward, isAuthenticated, loadReward, profileCompleted, refreshProfile, userId])

  useEffect(() => {
    if (current || queue.length === 0 || isClaimingReward.current) return

    const next = queue[0]
    let active = true
    isClaimingReward.current = true

    async function showRewardOnce() {
      // Persist first, then animate. Previously this happened only on dismiss,
      // so closing or backgrounding the app could replay the same reward on
      // every login.
      const { error } = await supabase.rpc('mark_reward_snackbar_seen', {
        p_reward_id: next.id,
      })

      if (!active) return
      isClaimingReward.current = false
      setQueue(previous => previous.filter(item => item.id !== next.id))

      if (error) {
        // Do not show a reward we could not durably claim. Removing it from
        // this in-memory queue avoids a retry loop; a later session can retry.
        knownIds.current.delete(next.id)
        return
      }

      setCurrent(next)
      hapticSuccess()
      void refreshProfile()
    }

    void showRewardOnce()
    return () => {
      active = false
      isClaimingReward.current = false
    }
  }, [current, queue, refreshProfile])

  const dismiss = useCallback(() => {
    if (!current) return
    setCurrent(null)
  }, [current])

  const openRewards = useCallback(() => {
    dismiss()
    onOpenRewards()
  }, [dismiss, onOpenRewards])

  return (
    <>
      {children}
      <RewardSnackbar reward={current} onDismiss={dismiss} onOpen={openRewards} />
    </>
  )
}
