'use client'

import { useEffect, useState, type FormEvent } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import type { EventInvitePreview } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { formatDate, titleCase } from '@/lib/format'

export function JoinEventForm() {
  const router = useRouter(); const searchParams = useSearchParams()
  const initialCode = searchParams.get('code')?.trim() ?? ''
  const [code, setCode] = useState(initialCode); const [preview, setPreview] = useState<EventInvitePreview | null>(null)
  const [loading, setLoading] = useState(Boolean(initialCode)); const [joining, setJoining] = useState(false); const [error, setError] = useState('')

  useEffect(() => {
    if (!initialCode) return
    const controller = new AbortController()
    runApiRead(call => createApiClient().events.previewInvite(initialCode, call), controller.signal).then(setPreview).catch(cause => setError(apiErrorMessage(cause))).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [initialCode])

  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(''); setPreview(null)
    try { setPreview(await runApiRead(call => createApiClient().events.previewInvite(code.trim(), call))) }
    catch (cause) { setError(apiErrorMessage(cause)) }
    finally { setLoading(false) }
  }
  async function join() {
    setJoining(true); setError('')
    try { const joined = await createApiClient().events.join(code.trim()); router.replace(`/account/events/${joined.event_id}?joined=1` as Route) }
    catch (cause) { setError(apiErrorMessage(cause)); setJoining(false) }
  }
  return <><section className="member-pagehead"><div><h1>Join an <em>event</em></h1><p>Enter the event invitation code to preview its date and venue before joining.</p></div><div className="member-page-actions"><Link href={'/account/events' as Route}>Back to events</Link></div></section><section className="member-card member-form-card"><header><div className="member-section-title"><span><KeyRound size={18} /></span><h2>Invitation code</h2></div></header><form className="member-join-form" onSubmit={find}><label><span>Event code</span><input value={code} onChange={event => setCode(event.target.value)} required minLength={8} maxLength={32} placeholder="Paste invitation code" /></label><button type="submit" disabled={loading}>{loading ? 'Checking…' : 'Find event'}</button></form>{preview && <div className="member-invite-preview"><div><span>{titleCase(preview.event_type)} {preview.has_linked_fund ? '· Event + Fund' : ''}</span><h3>{preview.event_emoji ?? '🎉'} {preview.name}</h3><p>{formatDate(preview.event_date)} · {preview.venue_name || 'Venue to be confirmed'} · Organised by {preview.organiser_name}</p></div>{preview.already_joined ? <p className="member-form-note"><strong>You already belong to this event.</strong></p> : <button type="button" onClick={join} disabled={joining || preview.status !== 'active'}>{joining ? 'Joining…' : preview.status === 'active' ? 'Join event' : 'Event is closed'}</button>}</div>}{error && <p className="member-form-error" role="alert">{error}</p>}</section></>
}
