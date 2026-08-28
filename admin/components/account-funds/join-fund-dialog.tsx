'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import type { FundInvitePreview } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { invalidateHomeSummary } from '@/lib/home-summary-cache'
import { formatMoney } from '@/lib/format'

type JoinFundDialogProps = {
  initialCode?: string
  onClose: () => void
}

export function JoinFundDialog({ initialCode = '', onClose }: JoinFundDialogProps) {
  const router = useRouter()
  const closeButton = useRef<HTMLButtonElement>(null)
  const normalizedInitialCode = initialCode.trim().toUpperCase()
  const [code, setCode] = useState(normalizedInitialCode)
  const [preview, setPreview] = useState<FundInvitePreview | null>(null)
  const [loading, setLoading] = useState(Boolean(normalizedInitialCode))
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  useEffect(() => {
    if (!normalizedInitialCode) return
    const controller = new AbortController()
    runApiRead(call => createApiClient().funds.previewInvite(normalizedInitialCode, call), controller.signal)
      .then(result => { if (!controller.signal.aborted) setPreview(result) })
      .catch(cause => { if (!controller.signal.aborted) setError(apiErrorMessage(cause)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [normalizedInitialCode])

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
      invalidateHomeSummary()
      if (result.membership_status === 'pending') router.replace('/account/funds?join=pending')
      else router.replace(`/account/funds/${result.fund_id}?joined=1` as Route)
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setJoining(false)
    }
  }

  return (
    <div className="tshelo-dashboard modal-root">
      <div className="overlay on" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
        <section className="modal member-join-dialog" role="dialog" aria-modal="true" aria-labelledby="join-fund-dialog-title">
          <header>
            <span className="itile sm"><KeyRound aria-hidden="true" /></span>
            <h3 id="join-fund-dialog-title">Join a fund</h3>
            <button ref={closeButton} className="x" type="button" onClick={onClose} aria-label="Close join fund dialog">&times;</button>
          </header>
          <div className="mbody">
            <p className="member-join-dialog-intro">Enter the invite code shared by the organiser. You can review the fund before joining.</p>
            <form className="member-join-form member-join-dialog-form" onSubmit={findFund}>
              <label><span>Fund code</span><input value={code} onChange={event => setCode(event.target.value.toUpperCase())} required maxLength={32} autoCapitalize="characters" placeholder="TSHELO123" /></label>
              <button className="btn purple" type="submit" disabled={loading}>{loading ? 'Checking…' : 'Find fund'}</button>
            </form>
            {preview && (
              <div className="member-join-dialog-preview">
                <div><span>{preview.is_private ? 'Private fund' : 'Open fund'}</span><h4>{preview.title}</h4><p>Organised by {preview.organiser_name} · {preview.member_count} member{preview.member_count === 1 ? '' : 's'}</p></div>
                <strong>{formatMoney(preview.goal_amount, preview.currency_code)} goal</strong>
                {preview.existing_membership_status
                  ? <p className="member-form-note">Your current membership status is <b>{preview.existing_membership_status}</b>.</p>
                  : <button className="btn purple" type="button" onClick={() => void join()} disabled={joining}>{joining ? 'Joining…' : preview.is_private ? 'Request to join' : 'Join fund'}</button>}
              </div>
            )}
            {error && <p className="member-form-error" role="alert">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
