import type { ApiResponse, IsoDateTime, Uuid } from './common'

export type RewardProgress = {
  reward_code: string
  name: string
  description: string
  category: string
  trust_points_reward: number
  threshold: number
  unit: string
  icon: string | null
  current: number
  is_earned: boolean
  earned_at: IsoDateTime | null
}

export type RewardTrustSummary = {
  trust_score: number
  trust_level: string
}

export type RewardProgressOverview = {
  rewards: RewardProgress[]
  trust: RewardTrustSummary
}

export type RewardSnackbarItem = {
  user_reward_id: Uuid
  reward_code: string
  name: string
  description: string
  category: string
  icon: string | null
  trust_points_awarded: number
  earned_at: IsoDateTime
}

export type EvaluateRewardsResult = {
  reward_count: number
}

export type EvaluateRewardsResponse = ApiResponse<EvaluateRewardsResult>
export type RewardProgressResponse = ApiResponse<RewardProgressOverview>
export type ListUnseenRewardsResponse = ApiResponse<RewardSnackbarItem[]>
export type MarkRewardSeenResponse = ApiResponse<Record<string, never>>
