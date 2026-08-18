import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { runApiRead } from '../lib/apiScreen'
import { useAuth } from './AuthContext'
import { hapticSuccess } from '../lib/haptics'
import RewardSnackbar, { RewardSnackbarItem } from '../components/RewardSnackbar'

function toSnackbarItem(row: Awaited<ReturnType<typeof api.rewards.listUnseen>>[number]): RewardSnackbarItem {
  return {
    id: row.user_reward_id,
    name: row.name,
    description: row.description,
    points: row.trust_points_awarded,
    iconName: row.icon ?? 'trophy-outline',
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

  useEffect(() => {
    if (!isAuthenticated || !profileCompleted || !userId) {
      setQueue([])
      setCurrent(null)
      knownIds.current.clear()
      isClaimingReward.current = false
      return
    }

    let active = true
    const controller = new AbortController()

    async function enqueueUnseenRewards() {
      const unseen = await runApiRead(
        call => api.rewards.listUnseen(call),
        { signal: controller.signal },
      )
      if (!active) return
      for (const reward of unseen) enqueueReward(toSnackbarItem(reward))
    }

    async function initialiseRewards() {
      // This safely backfills achievements earned before the reward system was
      // introduced and catches aggregate thresholds after offline activity.
      try {
        await api.rewards.evaluate({ signal: controller.signal })
        if (!active) return
        await enqueueUnseenRewards()
        await refreshProfile()
      } catch {
        // The poll or a later session will retry rewards that remain unseen.
      }
    }

    void initialiseRewards()
    const poll = setInterval(() => {
      void enqueueUnseenRewards().catch(() => undefined)
    }, 30_000)
    return () => {
      active = false
      controller.abort()
      clearInterval(poll)
    }
  }, [enqueueReward, isAuthenticated, profileCompleted, refreshProfile, userId])

  useEffect(() => {
    if (current || queue.length === 0 || isClaimingReward.current) return

    const next = queue[0]
    let active = true
    isClaimingReward.current = true

    async function showRewardOnce() {
      // Persist first, then animate. Previously this happened only on dismiss,
      // so closing or backgrounding the app could replay the same reward on
      // every login.
      let failed = false
      try {
        await api.rewards.markSeen(next.id)
      } catch {
        failed = true
      }

      if (!active) return
      isClaimingReward.current = false
      setQueue(previous => previous.filter(item => item.id !== next.id))

      if (failed) {
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
