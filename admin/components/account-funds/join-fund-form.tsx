'use client'

import { useEffect, useState, type FormEvent } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import type { FundInvitePreview } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { formatMoney } from '@/lib/format'

export function JoinFundForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCode = searchParams.get('code')?.trim().toUpperCase() ?? ''
  const [code, setCode] = useState(initialCode)
  const [preview, setPreview] = useState<FundInvitePreview | null>(null)
  const [loading, setLoading] = useState(Boolean(initialCode))
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initialCode) return
    const controller = new AbortController()
    runApiRead(call => createApiClient().funds.previewInvite(initialCode, call), controller.signal)
      .then(setPreview)
      .catch(cause => setError(apiErrorMessage(cause)))
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [initialCode])

  async function findFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (!normalized) return
    setLoading(true)
    setError('')
    setPreview(null)
    try {
      setPreview(await runApiRead(call => createApiClient().funds.previewInvite(normalized, call)))
      setCode(normalized)
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  async function join() {
    setJoining(true)
    setError('')
    try {
      const result = await createApiClient().funds.join({ code })
      if (result.membership_status === 'pending') router.replace('/account/funds?join=pending')
      else router.replace(`/account/funds/${result.fund_id}?joined=1` as Route)
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setJoining(false)
    }
  }

  return (
    <>
      <section className="member-pagehead"><div><h1>Join a <em>fund</em></h1><p>Enter the invite code shared by the organiser. We will show you the fund before you join.</p></div><div className="member-page-actions"><Link href="/account/funds">Back to funds</Link></div></section>
      <section className="member-card member-form-card">
        <header><div className="member-section-title"><span><KeyRound size={18} /></span><h2>Invite code</h2></div></header>
        <form className="member-join-form" onSubmit={findFund}>
          <label><span>Fund code</span><input value={code} onChange={event => setCode(event.target.value.toUpperCase())} required maxLength={32} autoCapitalize="characters" placeholder="TSHELO123" /></label>
          <button type="submit" disabled={loading}>{loading ? 'Checking…' : 'Find fund'}</button>
        </form>
        {preview && (
          <div className="member-invite-preview">
            <div><span>{preview.is_private ? 'Private fund' : 'Open fund'}</span><h3>{preview.title}</h3><p>Organised by {preview.organiser_name} · {preview.member_count} member{preview.member_count === 1 ? '' : 's'}</p></div>
            <strong>{formatMoney(preview.goal_amount, preview.currency_code)} goal</strong>
            {preview.existing_membership_status ? <p className="member-form-note">Your current membership status is <strong>{preview.existing_membership_status}</strong>.</p> : <button type="button" onClick={join} disabled={joining}>{joining ? 'Joining…' : preview.is_private ? 'Request to join' : 'Join fund'}</button>}
          </div>
        )}
        {error && <p className="member-form-error" role="alert">{error}</p>}
      </section>
    </>
  )
}
