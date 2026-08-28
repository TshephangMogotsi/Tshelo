'use client'

import { useRef, useState, type FormEvent } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarPlus, ChevronDown, HandCoins } from 'lucide-react'
import type { CreateEventFundRequest, CreateEventRequest, CurrencyCode, EventOrganiserInput, EventType } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage } from '@/lib/api-ui'
import { normalizeEventTime } from '@/lib/event-form'
import { invalidateHomeSummary } from '@/lib/home-summary-cache'
import { EventDateTimeField } from './event-date-time-field'

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
  const formRef = useRef<HTMLFormElement>(null)
  const [mode, setMode] = useState<'event' | 'eventFund'>('event')
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const stepLabels = ['Event details', 'Time & location', 'Co-organisers']
  const stepTitle = step === 0 && mode === 'eventFund' ? 'Event and fund details' : stepLabels[step]

  function chooseMode(nextMode: 'event' | 'eventFund') {
    setMode(nextMode)
    setStep(0)
    setError('')
  }

  function advance() {
    const missingPicker = formRef.current?.querySelector<HTMLButtonElement>(`[data-event-step="${step}"] [data-event-required="true"][data-event-value=""]`)
    if (missingPicker) {
      setError(`Choose ${missingPicker.dataset.eventLabel?.toLowerCase() ?? 'the required field'} before continuing.`)
      missingPicker.focus()
      return
    }
    const controls = formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-event-step="${step}"] input, [data-event-step="${step}"] select, [data-event-step="${step}"] textarea`)
    const invalidControl = controls && Array.from(controls).find(control => !control.checkValidity())
    if (invalidControl) {
      invalidControl.reportValidity()
      return
    }
    setError('')
    setStep(current => Math.min(current + 1, stepLabels.length - 1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < stepLabels.length - 1) {
      advance()
      return
    }
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
      event_time: normalizeEventTime(form.get('event_time')), venue_name: String(form.get('venue_name') ?? '').trim() || null,
      venue_address: String(form.get('venue_address') ?? '').trim() || null, currency_code: String(form.get('currency_code') ?? 'BWP') as CurrencyCode,
      organisers: organiser(form),
    }
    setSubmitting(true); setError('')
    try {
      if (mode === 'event') {
        const request: CreateEventRequest = {
          name: common.event_name, event_type: common.event_type, event_emoji: common.event_emoji, event_date: common.event_date,
          event_time: common.event_time, event_end_date: String(form.get('event_end_date') ?? '') || null,
          event_end_time: normalizeEventTime(form.get('event_end_time')), venue_name: common.venue_name,
          venue_address: common.venue_address, currency_code: common.currency_code, organisers: common.organisers,
          description: String(form.get('description') ?? '').trim() || null,
        }
        const created = await createApiClient().events.create(request)
        invalidateHomeSummary()
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
        invalidateHomeSummary()
        router.replace(`/account/events/${created.event_id}?created=1` as Route)
      }
    } catch (cause) { setError(apiErrorMessage(cause)); setSubmitting(false) }
  }

  return <>
    <section className="member-pagehead"><div><h1>Create an <em>event</em></h1></div><div className="member-page-actions"><Link href={'/account/events' as Route}>Cancel</Link></div></section>
    <div className="member-create-choice" role="group" aria-label="Event creation type"><button type="button" className={mode === 'event' ? 'active' : ''} aria-pressed={mode === 'event'} onClick={() => chooseMode('event')}><CalendarPlus size={18} /><span><strong>Event only</strong>Invitations, RSVPs, organisers and announcements</span></button><button type="button" className={mode === 'eventFund' ? 'active' : ''} aria-pressed={mode === 'eventFund'} onClick={() => chooseMode('eventFund')}><HandCoins size={18} /><span><strong>Event + Fund</strong>Add contribution tracking and a budget · costs 15 tokens</span></button></div>
    <section className="member-card member-form-card"><header><div className="member-section-title"><span><CalendarPlus size={18} /></span><h2>{stepTitle}</h2></div></header>
      <ol className="member-event-stepper" aria-label="Event creation progress">
        {stepLabels.map((label, index) => <li key={label} className={index === step ? 'active' : index < step ? 'complete' : ''}><button type="button" disabled={index > step} aria-current={index === step ? 'step' : undefined} onClick={() => index < step && setStep(index)}><span>{index + 1}</span>{label}</button></li>)}
      </ol>
      <form ref={formRef} className="member-form member-event-create-form" onSubmit={submit}>
        <div className="member-event-form-section" data-event-step="0" hidden={step !== 0}>
          <div className="member-event-name-field">
            <label className="member-event-field-label" htmlFor="event-name">Event name<b aria-hidden="true">*</b><span className="sr-only"> (required)</span></label>
            <input id="event-name" name="name" required minLength={3} maxLength={200} placeholder="Enter event name" />
          </div>
          {mode === 'event' && <label className="member-event-description"><span>Description</span><textarea name="description" rows={4} maxLength={4000} placeholder="What should guests know?" /></label>}
          <div className="member-event-basics-row">
            <label><span>Event type</span><span className="member-event-input-icon member-event-select-icon"><select name="event_type" defaultValue="wedding">{EVENT_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={18} aria-hidden="true" /></span></label>
            <label><span>Emoji</span><input name="event_emoji" maxLength={16} placeholder="🎉" /></label>
            <label><span>Currency</span><span className="member-event-input-icon member-event-select-icon"><select name="currency_code" defaultValue="BWP"><option value="BWP">BWP — Pula</option><option value="ZAR">ZAR — Rand</option><option value="USD">USD — Dollar</option></select><ChevronDown size={18} aria-hidden="true" /></span></label>
          </div>
        </div>

        <div className="member-event-form-section member-event-schedule" data-event-step="1" hidden={step !== 1}>
          <div className={mode === 'event' ? 'member-event-schedule-row' : 'member-event-schedule-row compact'}>
            <EventDateTimeField label="Date" name="event_date" type="date" required />
            <EventDateTimeField label="Start time" name="event_time" type="time" required={mode === 'eventFund'} />
            {mode === 'event' && <><EventDateTimeField label="End date" name="event_end_date" type="date" /><EventDateTimeField label="End time" name="event_end_time" type="time" /></>}
          </div>
          <p>{mode === 'event' ? 'End date and time are optional. Add them when guests need to know when the event finishes.' : 'Choose the event date and expected start time.'}</p>
        </div>

        <div className="member-event-form-section member-event-location-fields" data-event-step="1" hidden={step !== 1}>
          <label><span>Venue</span><input name="venue_name" required={mode === 'eventFund'} minLength={mode === 'eventFund' ? 3 : undefined} maxLength={200} placeholder="Choose a venue" /></label>
          <label><span>Address or Maps link</span><input name="venue_address" maxLength={2000} placeholder="Add an address or location link" /></label>
        </div>

        {mode === 'eventFund' && <div className="member-event-form-section member-event-fund-fields" data-event-step="0" hidden={step !== 0}>
          <label className="wide"><span>Fund name</span><input name="fund_title" required minLength={3} maxLength={200} placeholder="Wedding contribution fund" /></label>
          <div><label><span>Total event budget</span><input name="budget" type="number" min="0.01" step="0.01" required placeholder="0.00" /></label><label><span>Contribution goal</span><span className="member-event-input-icon member-event-select-icon"><select name="goal_percentage" defaultValue="65"><option value="50">50% of budget</option><option value="65">65% of budget</option><option value="75">75% of budget</option><option value="100">100% of budget</option></select><ChevronDown size={18} aria-hidden="true" /></span></label></div>
        </div>}

        <div className="member-event-form-section member-event-organiser-fields" data-event-step="2" hidden={step !== 2}>
          <div className="member-event-section-copy"><strong>Add a co-organiser</strong><span>Optional — they can help manage this event.</span></div>
          <div><label><span>Name</span><input name="organiser_name" maxLength={100} placeholder="Co-organiser name" /></label><label><span>Phone</span><input name="organiser_phone" type="tel" placeholder="+267 71 234 567" /></label></div>
        </div>
        {mode === 'eventFund' && <label className="member-check" data-event-step="0" hidden={step !== 0}><input type="checkbox" name="is_private" /><span><strong>Private contribution fund</strong>Fund join requests require organiser approval.</span></label>}
        {error && <p className="member-form-error" role="alert">{error}</p>}
        <div className="member-form-actions"><Link href={'/account/events' as Route}>Cancel</Link>{step > 0 && <button type="button" onClick={() => setStep(current => current - 1)}>Back</button>}{step < stepLabels.length - 1 ? <button className="primary" type="button" onClick={advance}>Continue</button> : <button className="primary" type="submit" disabled={submitting}>{submitting ? 'Creating…' : mode === 'eventFund' ? 'Create Event + Fund' : 'Create event'}</button>}</div>
      </form>
    </section>
  </>
}
