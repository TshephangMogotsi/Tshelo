'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Check,
  Clipboard,
  Infinity as InfinityIcon,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X,
} from 'lucide-react'
import type { EventGuest, EventGuestDirectory, EventWorkspace, RsvpStatus } from '@shared/contracts'
import { invitationUrl } from '@shared/invitations'
import { StatusPill } from '@/components/status-pill'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'

type GuestFilter = RsvpStatus | 'all'
type RsvpChoice = Exclude<RsvpStatus, 'pending'> | ''

function normalizePhone(value: string) {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+')) return `+${digits}`
  if (digits.length === 8) return `+267${digits}`
  return `+${digits}`
}

function guestName(guest: EventGuest) {
  return guest.guest_name || guest.guest_phone || 'Guest'
}

function guestContact(guest: EventGuest) {
  return [guest.guest_phone, guest.guest_email].filter(Boolean).join(' · ') || 'No contact details'
}

function GuestDialog({
  eventId,
  guest,
  onClose,
  onSaved,
}: {
  eventId: string
  guest?: EventGuest
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editing = Boolean(guest)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const allowedPlusOnes = Number(form.get('allowed_plus_ones') ?? 0)
    const input = {
      guest_name: String(form.get('guest_name') ?? '').trim(),
      guest_phone: normalizePhone(String(form.get('guest_phone') ?? '')),
      guest_email: String(form.get('guest_email') ?? '').trim() || null,
      allowed_plus_ones: allowedPlusOnes,
    }

    setBusy(true)
    setError('')
    try {
      if (guest) {
        const rsvpStatus = String(form.get('rsvp_status') ?? guest.rsvp_status) as RsvpStatus
        const plusOnes = rsvpStatus === 'no' ? 0 : Math.min(guest.plus_ones, allowedPlusOnes)
        await createApiClient().events.updateGuest(eventId, guest.id, {
          ...input,
          rsvp_status: rsvpStatus,
          plus_ones: plusOnes,
          plus_ones_names: guest.plus_ones_names.slice(0, plusOnes),
        })
        onSaved(`${input.guest_name} was updated.`)
      } else {
        const [createdGuest] = await createApiClient().events.inviteGuests(eventId, {
          guests: [{
            ...input,
            invitation_channel: input.guest_email ? 'email' : 'manual',
          }],
        })
        if (input.guest_email) {
          onSaved(createdGuest?.invitation_sent_at
            ? `${input.guest_name} was added and their invitation email was sent.`
            : `${input.guest_name} was added, but the invitation email could not be sent. Share the invitation link with them.`)
        } else {
          onSaved(`${input.guest_name} was added. Share the invitation link with them.`)
        }
      }
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setBusy(false)
    }
  }

  async function remove() {
    if (!guest || !window.confirm(`Remove ${guestName(guest)} from this event?`)) return
    setBusy(true)
    setError('')
    try {
      await createApiClient().events.removeGuest(eventId, guest.id)
      onSaved(`${guestName(guest)} was removed from the guest list.`)
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setBusy(false)
    }
  }

  return <div className="tshelo-dashboard modal-root">
    <div className="overlay on" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal member-guest-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-dialog-title">
        <header>
          <span className="member-section-icon"><UserRoundPlus size={18} /></span>
          <h3 id="guest-dialog-title">{editing ? 'Edit guest' : 'Add a guest'}</h3>
          <button className="x" type="button" onClick={onClose} aria-label="Close guest form"><X size={20} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="mbody member-form member-guest-form">
            <div className="member-form-grid">
              <label><span>Guest name</span><input name="guest_name" required maxLength={100} defaultValue={guest?.guest_name ?? ''} autoFocus /></label>
              <label><span>Phone number</span><input name="guest_phone" type="tel" required placeholder="+267 71 234 567" defaultValue={guest?.guest_phone ?? ''} /></label>
              <label><span>Email address</span><input name="guest_email" type="email" maxLength={255} placeholder="Optional" defaultValue={guest?.guest_email ?? ''} /></label>
              <label><span>Allowed plus-ones</span><input name="allowed_plus_ones" type="number" min="0" max="20" step="1" required defaultValue={guest?.allowed_plus_ones ?? 0} /></label>
              {guest && <label className="wide"><span>RSVP status</span><select name="rsvp_status" defaultValue={guest.rsvp_status}><option value="pending">Awaiting response</option><option value="yes">Attending</option><option value="maybe">Maybe</option><option value="no">Not attending</option></select></label>}
            </div>
            {!guest && <p className="member-form-note">An invitation email is sent automatically when you add an email address. Registered Tshelo users also receive an in-app invitation.</p>}
            {error && <p className="member-form-error" role="alert">{error}</p>}
          </div>
          <footer>
            {guest && <button className="btn member-guest-delete" type="button" onClick={remove} disabled={busy}><Trash2 size={14} /> Remove guest</button>}
            <button className="btn" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save guest' : 'Add guest'}</button>
          </footer>
        </form>
      </section>
    </div>
  </div>
}

function GuestManager({ workspace, reloadWorkspace }: { workspace: EventWorkspace; reloadWorkspace: () => void }) {
  const [directory, setDirectory] = useState<EventGuestDirectory | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [status, setStatus] = useState<GuestFilter>('all')
  const [version, setVersion] = useState(0)
  const [dialogGuest, setDialogGuest] = useState<EventGuest | 'new' | null>(null)
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const eventId = workspace.event.id
  const eventCode = workspace.event.share_code || workspace.event.event_code
  const inviteLink = invitationUrl('event', eventCode)

  const refresh = useCallback(() => {
    setLoading(true)
    setError('')
    setVersion(value => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    runApiRead(call => createApiClient().events.listGuests(eventId, {
      q: appliedSearch || undefined,
      status: status === 'all' ? undefined : status,
      sort_by: 'guest_name',
      sort_direction: 'asc',
      limit: 100,
    }, call), controller.signal)
      .then(setDirectory)
      .catch(cause => {
        const message = apiErrorMessage(cause)
        if (message) setError(message)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [eventId, appliedSearch, status, version])

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSearch = search.trim()
    if (nextSearch === appliedSearch) {
      refresh()
      return
    }
    setLoading(true)
    setError('')
    setAppliedSearch(nextSearch)
  }

  function filterByStatus(value: GuestFilter) {
    setLoading(true)
    setError('')
    setStatus(value)
  }

  function clearSearch() {
    setSearch('')
    setLoading(true)
    setError('')
    setAppliedSearch('')
  }

  async function loadMore() {
    const cursor = directory?.page.next_cursor
    if (!cursor) return
    setLoadingMore(true)
    setError('')
    try {
      const next = await createApiClient().events.listGuests(eventId, {
        q: appliedSearch || undefined,
        status: status === 'all' ? undefined : status,
        sort_by: 'guest_name',
        sort_direction: 'asc',
        limit: 100,
        cursor,
      })
      setDirectory(current => current ? { ...next, items: [...current.items, ...next.items] } : next)
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setLoadingMore(false)
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('The invitation link could not be copied. Please try again.')
    }
  }

  async function unlockCapacity() {
    const cost = directory?.capacity.unlock_cost_tokens ?? 10
    if (!window.confirm(`Use ${cost} tokens to unlock guest invitations above 100 people for this event?`)) return
    setBusy('unlock')
    setError('')
    try {
      await createApiClient().events.unlockGuestCapacity(eventId)
      setNotice('Additional guest capacity is now unlocked for this event.')
      refresh()
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setBusy('')
    }
  }

  function saved(message: string) {
    setDialogGuest(null)
    setNotice(message)
    refresh()
    reloadWorkspace()
  }

  const summary = directory?.summary
  const capacity = directory?.capacity
  const usedPercentage = capacity?.is_unlimited ? 100 : Math.min(100, ((capacity?.used ?? 0) / (capacity?.free_limit || 100)) * 100)

  return <>
    <section className="member-card member-guest-management" id="guests">
      <header>
        <div className="member-section-title"><span><UsersRound size={18} /></span><div><h2>Guest list</h2><small>Invite guests and track every RSVP</small></div></div>
        <div className="member-card-header-actions">
          <button className="member-guest-secondary-action" type="button" onClick={copyInvite}><Clipboard size={14} /> {copied ? 'Copied' : 'Copy invite link'}</button>
          {workspace.event.status === 'active' && <button className="member-header-action" type="button" onClick={() => setDialogGuest('new')}><Plus size={14} /> Add guest</button>}
        </div>
      </header>
      <div className="member-card-body">
        {notice && <p className="member-guest-notice"><Check size={14} /> {notice}</p>}
        {error && <p className="member-form-error" role="alert">{error}</p>}

        <div className="member-guest-summary" aria-label="Guest RSVP summary">
          <article><span>Invited</span><strong>{summary?.invited_people ?? 0}</strong><small>{summary?.invitation_count ?? 0} invitations</small></article>
          <article><span>Attending</span><strong>{summary?.confirmed_people ?? 0}</strong><small>Confirmed people</small></article>
          <article><span>Awaiting</span><strong>{summary?.pending_people ?? 0}</strong><small>{summary?.maybe_people ?? 0} marked maybe</small></article>
          <article><span>Declined</span><strong>{summary?.declined_people ?? 0}</strong><small>Not attending</small></article>
        </div>

        {capacity && <section className="member-guest-capacity" aria-label="Guest capacity">
          <div className="member-guest-capacity-copy">
            <span>{capacity.is_unlimited ? <InfinityIcon size={15} /> : <UsersRound size={15} />}</span>
            <div><strong>{capacity.is_unlimited ? 'Guest capacity unlocked' : `${capacity.used} of ${capacity.free_limit} free places reserved`}</strong><small>{capacity.is_unlimited ? 'This event can invite more than 100 people.' : 'Plus-one allowances count toward reserved places.'}</small></div>
          </div>
          {!capacity.is_unlimited && <><div className="member-guest-capacity-track" aria-hidden="true"><span style={{ width: `${usedPercentage}%` }} /></div><button type="button" onClick={unlockCapacity} disabled={busy === 'unlock'}>{busy === 'unlock' ? 'Unlocking…' : `Unlock above ${capacity.free_limit} · ${capacity.unlock_cost_tokens} tokens`}</button></>}
        </section>}

        <div className="member-guest-toolbar">
          <form onSubmit={applySearch} role="search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} maxLength={100} placeholder="Search guests" aria-label="Search guests" />{appliedSearch && <button type="button" onClick={clearSearch} aria-label="Clear guest search"><X size={14} /></button>}</form>
          <label><span className="sr-only">Filter by RSVP status</span><select value={status} onChange={event => filterByStatus(event.target.value as GuestFilter)}><option value="all">All responses</option><option value="yes">Attending</option><option value="maybe">Maybe</option><option value="pending">Awaiting RSVP</option><option value="no">Declined</option></select></label>
        </div>

        <div className="member-guest-list" aria-live="polite" aria-busy={loading}>
          {loading
            ? <div className="member-empty">Loading guest list…</div>
            : directory?.items.length
              ? directory.items.map(guest => <article key={guest.id}>
                <div className="member-directory-avatar">{guestName(guest).slice(0, 2).toUpperCase()}</div>
                <div className="member-guest-identity"><strong>{guestName(guest)}</strong><span>{guestContact(guest)}</span></div>
                <div className="member-guest-plus-ones"><span>Plus-ones</span><strong>{guest.plus_ones} / {guest.allowed_plus_ones}</strong></div>
                <StatusPill value={guest.rsvp_status} />
                <button className="member-guest-row-action" type="button" onClick={() => setDialogGuest(guest)} aria-label={`Edit ${guestName(guest)}`}><Pencil size={14} /><span>Edit</span></button>
              </article>)
              : <div className="member-empty">{appliedSearch || status !== 'all' ? 'No guests match these filters.' : 'No guests have been invited yet.'}</div>}
        </div>
        {directory?.page.has_more && <div className="member-guest-load-more"><button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more guests'}</button></div>}
      </div>
    </section>
    {dialogGuest && <GuestDialog key={dialogGuest === 'new' ? 'new' : dialogGuest.id} eventId={eventId} guest={dialogGuest === 'new' ? undefined : dialogGuest} onClose={() => setDialogGuest(null)} onSaved={saved} />}
  </>
}

function AttendeeRsvp({ workspace, reloadWorkspace }: { workspace: EventWorkspace; reloadWorkspace: () => void }) {
  const [guest, setGuest] = useState<EventGuest | null>(null)
  const [status, setStatus] = useState<RsvpChoice>('')
  const [plusOnes, setPlusOnes] = useState(0)
  const [plusOneNames, setPlusOneNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const eventId = workspace.event.id

  useEffect(() => {
    const controller = new AbortController()
    runApiRead(call => createApiClient().events.myRsvp(eventId, call), controller.signal)
      .then(value => {
        if (!value) return
        setGuest(value)
        setStatus(value.rsvp_status === 'pending' ? '' : value.rsvp_status)
        setPlusOnes(value.plus_ones)
        setPlusOneNames(value.plus_ones_names)
      })
      .catch(cause => {
        const message = apiErrorMessage(cause)
        if (message) setError(message)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [eventId])

  function changePlusOnes(value: number) {
    setPlusOnes(value)
    setPlusOneNames(current => Array.from({ length: value }, (_, index) => current[index] ?? ''))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!status) return
    const form = new FormData(event.currentTarget)
    const selectedPlusOnes = status === 'no' ? 0 : plusOnes
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await createApiClient().events.respondRsvp(eventId, {
        status,
        plus_ones: selectedPlusOnes,
        plus_ones_names: status === 'no' ? [] : plusOneNames.slice(0, selectedPlusOnes).map(name => name.trim()).filter(Boolean),
        rsvp_note: String(form.get('rsvp_note') ?? '').trim() || null,
        dietary_requirements: String(form.get('dietary_requirements') ?? '').trim() || null,
        accessibility_needs: String(form.get('accessibility_needs') ?? '').trim() || null,
      })
      setGuest(updated)
      setStatus(updated.rsvp_status === 'pending' ? '' : updated.rsvp_status)
      setPlusOnes(updated.plus_ones)
      setPlusOneNames(updated.plus_ones_names)
      setNotice('Your RSVP has been saved.')
      reloadWorkspace()
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <section className="member-card"><div className="member-empty">Loading your invitation…</div></section>
  if (!guest) return <section className="member-card"><div className="member-empty">Your guest invitation could not be found. Open the original invitation link or ask the organiser to invite your current phone number.</div></section>

  const canRespond = workspace.event.status === 'active'
  return <section className="member-card member-rsvp-card" id="guests">
    <header><div className="member-section-title"><span><UsersRound size={18} /></span><div><h2>Your RSVP</h2><small>Let the organiser know if you can attend</small></div></div><StatusPill value={guest.rsvp_status} /></header>
    <form className="member-rsvp-form" onSubmit={submit}>
      {notice && <p className="member-guest-notice"><Check size={14} /> {notice}</p>}
      {error && <p className="member-form-error" role="alert">{error}</p>}
      <div className="member-rsvp-intro"><strong>{guestName(guest)}</strong><span>{guestContact(guest)}</span></div>
      <fieldset className="member-rsvp-choices" disabled={!canRespond || busy}>
        <legend>Will you attend?</legend>
        <button type="button" className={status === 'yes' ? 'selected' : ''} onClick={() => setStatus('yes')} aria-pressed={status === 'yes'}><Check size={17} /><span><strong>Yes</strong><small>I’ll be there</small></span></button>
        <button type="button" className={status === 'maybe' ? 'selected' : ''} onClick={() => setStatus('maybe')} aria-pressed={status === 'maybe'}><span className="member-rsvp-choice-mark">?</span><span><strong>Maybe</strong><small>I’m not sure yet</small></span></button>
        <button type="button" className={status === 'no' ? 'selected' : ''} onClick={() => { setStatus('no'); changePlusOnes(0) }} aria-pressed={status === 'no'}><X size={17} /><span><strong>No</strong><small>I can’t attend</small></span></button>
      </fieldset>

      {status && status !== 'no' && guest.allowed_plus_ones > 0 && <section className="member-rsvp-plus-ones">
        <label><span>Guests joining you</span><select value={plusOnes} onChange={event => changePlusOnes(Number(event.target.value))} disabled={!canRespond || busy}>{Array.from({ length: guest.allowed_plus_ones + 1 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></label>
        {plusOnes > 0 && <div>{Array.from({ length: plusOnes }, (_, index) => <label key={index}><span>Plus-one {index + 1} name <small>Optional</small></span><input value={plusOneNames[index] ?? ''} onChange={event => setPlusOneNames(current => { const next = [...current]; next[index] = event.target.value; return next })} maxLength={100} placeholder="Guest name" disabled={!canRespond || busy} /></label>)}</div>}
      </section>}

      <div className="member-rsvp-details">
        <label><span>Dietary requirements <small>Optional</small></span><textarea name="dietary_requirements" maxLength={1000} rows={3} defaultValue={guest.dietary_requirements ?? ''} disabled={!canRespond || busy} /></label>
        <label><span>Accessibility needs <small>Optional</small></span><textarea name="accessibility_needs" maxLength={1000} rows={3} defaultValue={guest.accessibility_needs ?? ''} disabled={!canRespond || busy} /></label>
        <label className="wide"><span>Note to the organiser <small>Optional</small></span><textarea name="rsvp_note" maxLength={2000} rows={3} defaultValue={guest.rsvp_note ?? ''} disabled={!canRespond || busy} /></label>
      </div>
      <div className="member-rsvp-contact"><Phone size={14} /><span>{guest.guest_phone}</span>{guest.guest_email && <><Mail size={14} /><span>{guest.guest_email}</span></>}</div>
      <div className="member-form-actions"><button className="primary" type="submit" disabled={!canRespond || !status || busy}>{busy ? 'Saving RSVP…' : 'Save RSVP'}</button></div>
      {!canRespond && <p className="member-form-note">This event is {workspace.event.status}, so RSVP responses are closed.</p>}
    </form>
  </section>
}

export function EventGuests({ workspace, reloadWorkspace }: { workspace: EventWorkspace; reloadWorkspace: () => void }) {
  const canManage = workspace.capabilities.is_creator
    || workspace.capabilities.is_organiser
    || workspace.capabilities.linked_fund_permissions.includes('manage_event_guests')

  return canManage
    ? <GuestManager workspace={workspace} reloadWorkspace={reloadWorkspace} />
    : <AttendeeRsvp workspace={workspace} reloadWorkspace={reloadWorkspace} />
}
