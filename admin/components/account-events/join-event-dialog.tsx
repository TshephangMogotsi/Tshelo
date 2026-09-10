'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { Check, KeyRound, UsersRound, X } from 'lucide-react'
import type { EventInvitePreview, RsvpStatus } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { invalidateHomeSummary } from '@/lib/home-summary-cache'
import { formatDate, titleCase } from '@/lib/format'

type JoinEventDialogProps = {
  initialCode?: string
  onClose: () => void
}

type RsvpChoice = Exclude<RsvpStatus, 'pending'> | ''

function allowanceTitle(allowedPlusOnes: number) {
  if (allowedPlusOnes <= 0) return 'This invitation is for you only.'
  if (allowedPlusOnes === 1) return 'This invitation is for you and 1 additional guest.'
  return `This invitation is for you and up to ${allowedPlusOnes} additional guests.`
}

export function JoinEventDialog({ initialCode = '', onClose }: JoinEventDialogProps) {
  const router = useRouter()
  const closeButton = useRef<HTMLButtonElement>(null)
  const normalizedInitialCode = initialCode.trim()
  const [code, setCode] = useState(normalizedInitialCode)
  const [preview, setPreview] = useState<EventInvitePreview | null>(null)
  const [loading, setLoading] = useState(Boolean(normalizedInitialCode))
  const [joining, setJoining] = useState(false)
  const [rsvpStatus, setRsvpStatus] = useState<RsvpChoice>('')
  const [plusOnes, setPlusOnes] = useState(0)
  const [plusOneNames, setPlusOneNames] = useState<string[]>([])
  const [error, setError] = useState('')
  const allowedPlusOnes = Math.max(0, Math.min(20, Number(preview?.allowed_plus_ones) || 0))

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
      const nextPreview = await runApiRead(call => createApiClient().events.previewInvite(normalized, call))
      setPreview(nextPreview)
      setCode(normalized)
      setRsvpStatus('')
      setPlusOnes(0)
      setPlusOneNames([])
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  function changePlusOnes(value: number) {
    setPlusOnes(value)
    setPlusOneNames(current => Array.from({ length: value }, (_, index) => current[index] ?? ''))
  }

  function selectRsvp(status: RsvpChoice) {
    setRsvpStatus(status)
    if (status === 'no') changePlusOnes(0)
  }

  async function confirmRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preview || !rsvpStatus || preview.already_joined) return
    const selectedPlusOnes = rsvpStatus === 'no' ? 0 : plusOnes
    setJoining(true)
    setError('')
    try {
      await createApiClient().events.respondRsvp(preview.id, {
        code: code.trim(),
        status: rsvpStatus,
        plus_ones: selectedPlusOnes,
        plus_ones_names: rsvpStatus === 'no'
          ? []
          : plusOneNames.slice(0, selectedPlusOnes).map(name => name.trim()).filter(Boolean),
      })
      invalidateHomeSummary()
      router.replace(`/account/events/${preview.id}?joined=1` as Route)
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
                  ? <><p className="member-form-note"><b>You already belong to this event.</b></p><button className="btn purple" type="button" onClick={() => router.replace(`/account/events/${preview.id}` as Route)}>Open event</button></>
                  : <>
                    <section className="member-invite-allowance" aria-label="Invitation guest allowance">
                      <span><UsersRound size={18} aria-hidden="true" /></span>
                      <div><strong>{allowanceTitle(allowedPlusOnes)}</strong><small>{allowedPlusOnes > 0 ? 'Choose how many guests will join you when you respond.' : 'No additional guests are included with this invitation.'}</small></div>
                    </section>
                    <form className="member-join-rsvp" onSubmit={confirmRsvp}>
                      <fieldset className="member-rsvp-choices" disabled={joining}>
                        <legend>Will you attend?</legend>
                        <button type="button" className={rsvpStatus === 'yes' ? 'selected' : ''} onClick={() => selectRsvp('yes')} aria-pressed={rsvpStatus === 'yes'}><Check size={17} /><span><strong>Yes</strong><small>I’ll be there</small></span></button>
                        <button type="button" className={rsvpStatus === 'maybe' ? 'selected' : ''} onClick={() => selectRsvp('maybe')} aria-pressed={rsvpStatus === 'maybe'}><span className="member-rsvp-choice-mark">?</span><span><strong>Maybe</strong><small>I’m not sure</small></span></button>
                        <button type="button" className={rsvpStatus === 'no' ? 'selected' : ''} onClick={() => selectRsvp('no')} aria-pressed={rsvpStatus === 'no'}><X size={17} /><span><strong>No</strong><small>I can’t attend</small></span></button>
                      </fieldset>

                      {rsvpStatus && rsvpStatus !== 'no' && allowedPlusOnes > 0 && <section className="member-rsvp-plus-ones">
                        <label><span>Guests joining you</span><select value={plusOnes} onChange={event => changePlusOnes(Number(event.target.value))} disabled={joining}>{Array.from({ length: allowedPlusOnes + 1 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></label>
                        {plusOnes > 0 && <div>{Array.from({ length: plusOnes }, (_, index) => <label key={index}><span>Guest {index + 1} name <small>Optional</small></span><input value={plusOneNames[index] ?? ''} onChange={event => setPlusOneNames(current => { const next = [...current]; next[index] = event.target.value; return next })} maxLength={100} placeholder="Guest name" disabled={joining} /></label>)}</div>}
                      </section>}

                      <button className="btn purple member-join-confirm" type="submit" disabled={!rsvpStatus || joining}>{joining ? 'Saving RSVP…' : 'Save RSVP and open event'}</button>
                    </form>
                  </>}
              </div>
            )}
            {error && <p className="member-form-error" role="alert">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
