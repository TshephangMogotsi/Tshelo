'use client'

import { useState, type FormEvent } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarPlus, HandCoins } from 'lucide-react'
import type { CreateEventFundRequest, CreateEventRequest, CurrencyCode, EventOrganiserInput, EventType } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage } from '@/lib/api-ui'

const EVENT_TYPES = [['wedding', 'Wedding'], ['funeral', 'Funeral'], ['graduation', 'Graduation'], ['birthday', 'Birthday'], ['baby_shower', 'Baby shower'], ['kitchen_party', 'Kitchen party'], ['tombstone', 'Tombstone'], ['other', 'Other']] as const

function organiser(form: FormData): EventOrganiserInput[] {
  const name = String(form.get('organiser_name') ?? '').trim()
  const raw = String(form.get('organiser_phone') ?? '').trim()
  if (!name && !raw) return []
  const digits = raw.replace(/\D/g, '')
  const phone = raw.startsWith('+') ? `+${digits}` : digits.length === 8 ? `+267${digits}` : `+${digits}`
  return [{ name, phone }]
}

export function CreateEventForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'event' | 'eventFund'>('event')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const organiserName = String(form.get('organiser_name') ?? '').trim()
    const organiserPhone = String(form.get('organiser_phone') ?? '').trim()
    if (Boolean(organiserName) !== Boolean(organiserPhone)) {
      setError('Enter both the co-organiser name and phone number, or leave both blank.')
      return
    }
    const common = {
      event_name: String(form.get('name') ?? '').trim(), event_type: String(form.get('event_type') ?? 'other') as EventType,
      event_emoji: String(form.get('event_emoji') ?? '').trim() || null, event_date: String(form.get('event_date') ?? ''),
      event_time: String(form.get('event_time') ?? '') || null, venue_name: String(form.get('venue_name') ?? '').trim() || null,
      venue_address: String(form.get('venue_address') ?? '').trim() || null, currency_code: String(form.get('currency_code') ?? 'BWP') as CurrencyCode,
      organisers: organiser(form),
    }
    setSubmitting(true); setError('')
    try {
      if (mode === 'event') {
        const request: CreateEventRequest = {
          name: common.event_name, event_type: common.event_type, event_emoji: common.event_emoji, event_date: common.event_date,
          event_time: common.event_time, event_end_date: String(form.get('event_end_date') ?? '') || null,
          event_end_time: String(form.get('event_end_time') ?? '') || null, venue_name: common.venue_name,
          venue_address: common.venue_address, currency_code: common.currency_code, organisers: common.organisers,
          description: String(form.get('description') ?? '').trim() || null,
        }
        const created = await createApiClient().events.create(request)
        router.replace(`/account/events/${created.id}?created=1` as Route)
      } else {
        const request: CreateEventFundRequest = {
          event_name: common.event_name, event_type: common.event_type, event_emoji: common.event_emoji,
          event_date: common.event_date, event_time: common.event_time || '', event_venue: common.venue_name || '',
          venue_address: common.venue_address, fund_title: String(form.get('fund_title') ?? '').trim(),
          currency_code: common.currency_code, budget: String(form.get('budget') ?? '').trim(),
          goal_percentage: Number(form.get('goal_percentage') ?? 65), is_private: form.get('is_private') === 'on', organisers: common.organisers,
        }
        const created = await createApiClient().events.createFund(request)
        router.replace(`/account/events/${created.event_id}?created=1` as Route)
      }
    } catch (cause) { setError(apiErrorMessage(cause)); setSubmitting(false) }
  }

  return <>
    <section className="member-pagehead"><div><h1>Create an <em>event</em></h1><p>Plan invitations only, or create an Event + Fund when you also need contributions and a shared budget.</p></div><div className="member-page-actions"><Link href={'/account/events' as Route}>Cancel</Link></div></section>
    <div className="member-create-choice" role="group" aria-label="Event creation type"><button type="button" className={mode === 'event' ? 'active' : ''} onClick={() => setMode('event')}><CalendarPlus size={18} /><span><strong>Event only</strong>Invitations, RSVPs, organisers and announcements</span></button><button type="button" className={mode === 'eventFund' ? 'active' : ''} onClick={() => setMode('eventFund')}><HandCoins size={18} /><span><strong>Event + Fund</strong>Add contribution tracking and a budget · costs 15 tokens</span></button></div>
    <section className="member-card member-form-card"><header><div className="member-section-title"><span><CalendarPlus size={18} /></span><h2>{mode === 'eventFund' ? 'Event and fund details' : 'Event details'}</h2></div></header>
      <form className="member-form" onSubmit={submit}>
        <div className="member-form-grid">
          <label className="wide"><span>Event name</span><input name="name" required minLength={3} maxLength={200} placeholder="e.g. Thato & Kabelo's wedding" /></label>
          <label><span>Event type</span><select name="event_type" defaultValue="wedding">{EVENT_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>Emoji</span><input name="event_emoji" maxLength={16} placeholder="🎉" /></label>
          <label><span>Date</span><input name="event_date" type="date" required /></label>
          <label><span>Start time</span><input name="event_time" type="time" required={mode === 'eventFund'} /></label>
          {mode === 'event' && <><label><span>End date</span><input name="event_end_date" type="date" /></label><label><span>End time</span><input name="event_end_time" type="time" /></label></>}
          <label><span>Venue</span><input name="venue_name" required={mode === 'eventFund'} minLength={mode === 'eventFund' ? 3 : undefined} maxLength={200} placeholder="Venue name" /></label>
          <label><span>Address or Maps link</span><input name="venue_address" maxLength={2000} placeholder="Location details" /></label>
          <label><span>Currency</span><select name="currency_code" defaultValue="BWP"><option value="BWP">BWP — Pula</option><option value="ZAR">ZAR — Rand</option><option value="USD">USD — Dollar</option></select></label>
          {mode === 'event' && <label className="wide"><span>Description</span><textarea name="description" rows={4} maxLength={4000} placeholder="What should guests know?" /></label>}
          {mode === 'eventFund' && <><label className="wide"><span>Fund name</span><input name="fund_title" required minLength={3} maxLength={200} placeholder="Wedding contribution fund" /></label><label><span>Total event budget</span><input name="budget" type="number" min="0.01" step="0.01" required /></label><label><span>Contribution goal</span><select name="goal_percentage" defaultValue="65"><option value="50">50% of budget</option><option value="65">65% of budget</option><option value="75">75% of budget</option><option value="100">100% of budget</option></select></label></>}
          <label><span>Co-organiser name</span><input name="organiser_name" maxLength={100} placeholder="Optional" /></label>
          <label><span>Co-organiser phone</span><input name="organiser_phone" type="tel" placeholder="+267 71 234 567" /></label>
        </div>
        {mode === 'eventFund' && <label className="member-check"><input type="checkbox" name="is_private" /><span><strong>Private contribution fund</strong>Fund join requests require organiser approval.</span></label>}
        {error && <p className="member-form-error" role="alert">{error}</p>}
        <div className="member-form-actions"><Link href={'/account/events' as Route}>Cancel</Link><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Creating…' : mode === 'eventFund' ? 'Create Event + Fund' : 'Create event'}</button></div>
      </form>
    </section>
  </>
}
