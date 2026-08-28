'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import type { EventInvitePreview } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { invalidateHomeSummary } from '@/lib/home-summary-cache'
import { formatDate, titleCase } from '@/lib/format'

type JoinEventDialogProps = {
  initialCode?: string
  onClose: () => void
}

export function JoinEventDialog({ initialCode = '', onClose }: JoinEventDialogProps) {
  const router = useRouter()
  const closeButton = useRef<HTMLButtonElement>(null)
  const normalizedInitialCode = initialCode.trim()
  const [code, setCode] = useState(normalizedInitialCode)
  const [preview, setPreview] = useState<EventInvitePreview | null>(null)
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
    runApiRead(call => createApiClient().events.previewInvite(normalizedInitialCode, call), controller.signal)
      .then(result => { if (!controller.signal.aborted) setPreview(result) })
      .catch(cause => { if (!controller.signal.aborted) setError(apiErrorMessage(cause)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [normalizedInitialCode])

  async function findEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = code.trim()
    if (!normalized) return
    setLoading(true)
    setError('')
    setPreview(null)
    try {
      setPreview(await runApiRead(call => createApiClient().events.previewInvite(normalized, call)))
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
      const joined = await createApiClient().events.join(code.trim())
      invalidateHomeSummary()
      router.replace(`/account/events/${joined.event_id}?joined=1` as Route)
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setJoining(false)
    }
  }

  return (
    <div className="tshelo-dashboard modal-root">
      <div className="overlay on" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
        <section className="modal member-join-dialog" role="dialog" aria-modal="true" aria-labelledby="join-event-dialog-title">
          <header>
            <span className="itile sm"><KeyRound aria-hidden="true" /></span>
            <h3 id="join-event-dialog-title">Join an event</h3>
            <button ref={closeButton} className="x" type="button" onClick={onClose} aria-label="Close join event dialog">&times;</button>
          </header>
          <div className="mbody">
            <p className="member-join-dialog-intro">Enter the invitation code to review the event before joining.</p>
            <form className="member-join-form member-join-dialog-form" onSubmit={findEvent}>
              <label><span>Event code</span><input value={code} onChange={event => setCode(event.target.value)} required minLength={8} maxLength={32} placeholder="Paste invitation code" /></label>
              <button className="btn purple" type="submit" disabled={loading}>{loading ? 'Checking…' : 'Find event'}</button>
            </form>
            {preview && (
              <div className="member-join-dialog-preview">
                <div><span>{titleCase(preview.event_type)} {preview.has_linked_fund ? '· Event + Fund' : ''}</span><h4>{preview.event_emoji ?? '🎉'} {preview.name}</h4><p>{formatDate(preview.event_date)} · {preview.venue_name || 'Venue to be confirmed'} · Organised by {preview.organiser_name}</p></div>
                {preview.already_joined
                  ? <p className="member-form-note"><b>You already belong to this event.</b></p>
                  : <button className="btn purple" type="button" onClick={() => void join()} disabled={joining || preview.status !== 'active'}>{joining ? 'Joining…' : preview.status === 'active' ? 'Join event' : 'Event is closed'}</button>}
              </div>
            )}
            {error && <p className="member-form-error" role="alert">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
