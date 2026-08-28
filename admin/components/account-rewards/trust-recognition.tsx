'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import {
  Award,
  BadgeCheck,
  Check,
  CircleCheck,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react'
import type { RewardProgress, RewardProgressOverview, RichAuntieRecipientHistory } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { formatDate, formatMoney, titleCase } from '@/lib/format'

const TRUST_EXPLANATIONS: Record<string, string> = {
  new: 'You are getting started. Reliable activity builds your trust over time.',
  basic: 'You have begun building a record of reliable activity.',
  trusted: 'Your consistent participation has earned a trusted standing.',
  verified: 'You have reached the highest trust standing through reliable activity.',
}

function progressPercentage(reward: RewardProgress) {
  if (reward.is_earned) return 100
  if (reward.threshold <= 0) return 0
  return Math.max(0, Math.min(100, (reward.current / reward.threshold) * 100))
}

function rewardProgressCopy(reward: RewardProgress) {
  if (reward.is_earned) return reward.earned_at ? `Earned ${formatDate(reward.earned_at)}` : 'Earned'
  if (reward.reward_code === 'transparent_organiser') return '80% receipt coverage across 5 expenses'
  return `${Math.min(reward.current, reward.threshold)} of ${reward.threshold} ${reward.unit}`
}

function pluralize(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? '' : 's'}`
}

function RewardCard({ reward }: { reward: RewardProgress }) {
  const earned = reward.is_earned

  return (
    <article className={`member-reward-card ${earned ? 'earned' : ''}`}>
      <div className="member-reward-icon">{earned ? <Check size={20} /> : <Trophy size={20} />}</div>
      <div className="member-reward-copy">
        <div className="member-reward-heading">
          <h3>{reward.name}</h3>
          {earned && <span><Check size={12} /> Earned</span>}
        </div>
        <p>{reward.description}</p>
        <div className="member-reward-progress" aria-label={`${reward.name}: ${rewardProgressCopy(reward)}`}>
          <div><i style={{ width: `${progressPercentage(reward)}%` }} /></div>
          <span>{rewardProgressCopy(reward)}</span>
        </div>
      </div>
      <div className="member-reward-points"><strong>+{reward.trust_points_reward}</strong><span>trust</span></div>
    </article>
  )
}

function RecognitionContent({
  recognition,
  onShare,
  isSharing,
}: {
  recognition: RichAuntieRecipientHistory
  onShare: () => void
  isSharing: boolean
}) {
  const hasAwards = recognition.is_rich_auntie || recognition.award_count > 0

  return (
    <>
      <section className={`member-recognition-hero ${hasAwards ? 'recognised' : ''}`}>
        <div className="member-recognition-emblem">{hasAwards ? <Award size={28} /> : <Sparkles size={28} />}</div>
        <div className="member-recognition-intro">
          <span>Personal recognition</span>
          <h2>{hasAwards ? 'You’re a Rich Auntie!' : 'Rich Auntie status'}</h2>
          <p>{hasAwards
            ? 'Fund organisers have recognised the support you have given to the community.'
            : 'Awards from your fund organisers will appear here when you receive them.'}
          </p>
        </div>
        {hasAwards && (
          <button type="button" className="member-recognition-share" disabled={isSharing} onClick={onShare}>
            <Share2 size={15} /> {isSharing ? 'Preparing…' : 'Share my status'}
          </button>
        )}
      </section>

      <div className="member-recognition-stats">
        <div><span>Cash given</span><strong>{formatMoney(recognition.cash_given, 'BWP')}</strong></div>
        <div><span>Funds helped</span><strong>{recognition.fund_count}</strong></div>
        <div><span>Awards received</span><strong>{recognition.award_count}</strong></div>
      </div>

      <div className="member-recognition-achievements">
        <div className="member-recognition-subhead"><BadgeCheck size={17} /><h3>Your recognition</h3></div>
        {recognition.is_consistent_contributor && (
          <div className="member-recognition-achievement consistent">
            <span><RefreshCw size={17} /></span>
            <div><strong>Consistent Contributor</strong><p>Automatically recognised for confirmed contributions across three or more funds.</p></div>
            <i>Automatic</i>
          </div>
        )}
        {recognition.awards.map(award => (
          <article className="member-recognition-achievement" key={award.id}>
            <span><Award size={17} /></span>
            <div>
              <strong>{award.reason_label}</strong>
              <p><Link href={`/account/funds/${award.fund_id}` as Route}>{award.fund_title}</Link> · awarded by {award.awarded_by_name} · {formatDate(award.created_at)}</p>
            </div>
            <i>Awarded</i>
          </article>
        ))}
        {!recognition.is_consistent_contributor && !recognition.awards.length && (
          <div className="member-recognition-empty">
            <Award size={25} />
            <strong>No recognition yet</strong>
            <p>Keep showing up for your funds. Organisers can send an award when they want to celebrate your support.</p>
          </div>
        )}
      </div>
    </>
  )
}

export function TrustRecognition() {
  const [overview, setOverview] = useState<RewardProgressOverview | null>(null)
  const [recognition, setRecognition] = useState<RichAuntieRecipientHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [shareNotice, setShareNotice] = useState('')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      runApiRead(call => createApiClient().rewards.progress(call), controller.signal),
      runApiRead(call => createApiClient().richAuntie.status(call), controller.signal),
    ])
      .then(([rewardOverview, richAuntieRecognition]) => {
        if (controller.signal.aborted) return
        setOverview(rewardOverview)
        setRecognition(richAuntieRecognition)
      })
      .catch(cause => {
        const message = apiErrorMessage(cause)
        if (!controller.signal.aborted && message) setError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [refreshVersion])

  const earnedRewards = useMemo(() => overview?.rewards.filter(reward => reward.is_earned) ?? [], [overview])
  const inProgressRewards = useMemo(() => overview?.rewards.filter(reward => !reward.is_earned) ?? [], [overview])
  const trustScore = Math.max(0, Math.min(100, overview?.trust.trust_score ?? 0))
  const trustLevel = overview?.trust.trust_level ?? 'new'

  function retry() {
    setLoading(true)
    setError('')
    setShareNotice('')
    setRefreshVersion(version => version + 1)
  }

  async function shareStatus() {
    if (!recognition || recognition.award_count < 1) return
    const message = `♛ I’ve been recognised as a Rich Auntie on Tshelo — ${pluralize(recognition.award_count, 'award')} across ${pluralize(recognition.fund_count, 'fund')}.`
    setSharing(true)
    setError('')
    setShareNotice('')

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'My Rich Auntie status', text: message })
        setShareNotice('Your status is ready to share.')
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message)
        setShareNotice('Your status has been copied. Share it wherever you like.')
        return
      }
      setError('Sharing is not available in this browser. Please copy your status manually.')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError('Your status could not be shared. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
      <section className="member-pagehead">
        <div>
          <h1>Trust &amp; <em>rewards</em></h1>
        </div>
      </section>

      {shareNotice && <p className="member-success-note" role="status"><CircleCheck size={16} /> {shareNotice}</p>}
      {error && <p className="member-form-error member-recognition-error" role="alert">{error}</p>}

      {loading && <section className="member-card"><div className="member-api-state"><p>Loading your trust and recognition…</p></div></section>}
      {!loading && error && (!overview || !recognition) && (
        <section className="member-card"><div className="member-api-state error"><p>Your trust and recognition could not be loaded.</p><button type="button" onClick={retry}><RefreshCw size={14} /> Try again</button></div></section>
      )}
      {!loading && overview && recognition && (
        <>
          <section className="member-recognition-overview">
            <div className="member-trust-score">
              <span>Your trust points</span>
              <strong>{trustScore}<small>/ 100</small></strong>
              <p>{earnedRewards.length} {earnedRewards.length === 1 ? 'achievement' : 'achievements'} earned</p>
            </div>
            <div className="member-trust-level">
              <div className="member-section-title"><span><ShieldCheck size={18} /></span><div><p>Trust level</p><h2>{titleCase(trustLevel)}</h2></div></div>
              <strong>{trustScore}/100</strong>
              <div className="member-trust-meter" aria-label={`Trust score ${trustScore} out of 100`}><i style={{ width: `${trustScore}%` }} /></div>
              <p>{TRUST_EXPLANATIONS[trustLevel] ?? 'Your trust level reflects reliable activity in Tshelo.'}</p>
              <small>Trust points cannot be bought, transferred, redeemed, or exchanged for cash.</small>
            </div>
          </section>

          <section className="member-card member-recognition-card">
            <header><div className="member-section-title"><span><Award size={18} /></span><h2>Rich Auntie recognition</h2></div></header>
            <div className="member-card-body"><RecognitionContent recognition={recognition} onShare={() => void shareStatus()} isSharing={sharing} /></div>
          </section>

          {earnedRewards.length > 0 && (
            <section className="member-card member-rewards-card">
              <header><div className="member-section-title"><span><Check size={18} /></span><h2>Achievements earned</h2></div><p>{earnedRewards.length} complete</p></header>
              <div className="member-card-body"><div className="member-reward-list">{earnedRewards.map(reward => <RewardCard key={reward.reward_code} reward={reward} />)}</div></div>
            </section>
          )}

          {inProgressRewards.length > 0 && (
            <section className="member-card member-rewards-card">
              <header><div className="member-section-title"><span><Trophy size={18} /></span><h2>Keep going</h2></div><p>{inProgressRewards.length} in progress</p></header>
              <div className="member-card-body"><div className="member-reward-list">{inProgressRewards.map(reward => <RewardCard key={reward.reward_code} reward={reward} />)}</div></div>
            </section>
          )}
        </>
      )}
    </>
  )
}
