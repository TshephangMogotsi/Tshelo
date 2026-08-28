'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'

type EventDateTimeFieldProps = {
  label: string
  name: string
  type: 'date' | 'time'
  required?: boolean
}

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value: string) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function calendarDays(month: Date) {
  const firstVisible = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
  return Array.from({ length: 42 }, (_, index) => new Date(firstVisible.getFullYear(), firstVisible.getMonth(), firstVisible.getDate() + index))
}

function formatDate(value: string) {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat('en-GB').format(date) : 'dd/mm/yyyy'
}

function centerSelected(container: HTMLDivElement | null) {
  const selected = container?.querySelector<HTMLElement>('[aria-selected="true"]')
  if (!container || !selected) return
  container.scrollTop = selected.offsetTop - container.clientHeight / 2 + selected.offsetHeight / 2
}

export function EventDateTimeField({ label, name, type, required = false }: EventDateTimeFieldProps) {
  const popoverId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const hourListRef = useRef<HTMLDivElement>(null)
  const minuteListRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => monthStart(new Date()))
  const [draftHour, setDraftHour] = useState('09')
  const [draftMinute, setDraftMinute] = useState('00')

  useEffect(() => {
    if (!open) return
    function dismiss(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open || type !== 'time') return
    centerSelected(hourListRef.current)
    centerSelected(minuteListRef.current)
  }, [draftHour, draftMinute, open, type])

  function toggle() {
    if (!open) {
      if (type === 'date') setViewMonth(monthStart(parseDate(value) ?? new Date()))
      if (type === 'time') {
        const [hour, minute] = value.split(':')
        setDraftHour(hour || '09')
        setDraftMinute(minute || '00')
      }
    }
    setOpen(current => !current)
  }

  const selectedDate = parseDate(value)
  const today = toIsoDate(new Date())

  return <label className="member-event-picker-field">
    <span className="member-event-field-label">{label}{required && <><b aria-hidden="true">*</b><span className="sr-only"> (required)</span></>}</span>
    <div className="member-event-picker" ref={rootRef}>
      <button
        className={`member-event-picker-trigger ${value ? 'has-value' : ''}`}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={popoverId}
        data-event-required={required ? 'true' : undefined}
        data-event-label={label}
        data-event-value={value}
        onClick={toggle}
      >
        <span>{type === 'date' ? formatDate(value) : value || '--:--'}</span>
        {type === 'date' ? <CalendarDays size={19} aria-hidden="true" /> : <Clock3 size={19} aria-hidden="true" />}
      </button>
      <input type="hidden" name={name} value={value} />
      {open && <div className={`member-event-picker-popover ${type}`} id={popoverId} role="dialog" aria-label={`Choose ${label.toLowerCase()}`}>
        {type === 'date' ? <>
          <header>
            <strong>{viewMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</strong>
            <div><button type="button" aria-label="Previous month" onClick={() => setViewMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><button type="button" aria-label="Next month" onClick={() => setViewMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div>
          </header>
          <div className="member-event-calendar-weekdays" aria-hidden="true">{WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="member-event-calendar-days">{calendarDays(viewMonth).map(date => {
            const iso = toIsoDate(date)
            const outside = date.getMonth() !== viewMonth.getMonth()
            const selected = selectedDate ? iso === value : false
            return <button type="button" key={iso} className={`${outside ? 'outside' : ''} ${selected ? 'selected' : ''} ${iso === today ? 'today' : ''}`} aria-pressed={selected} onClick={() => { setValue(iso); setOpen(false) }}>{date.getDate()}</button>
          })}</div>
          <footer><button type="button" onClick={() => { setValue(''); setOpen(false) }}>Clear</button><button type="button" onClick={() => { setValue(today); setViewMonth(monthStart(new Date())); setOpen(false) }}>Today</button></footer>
        </> : <>
          <header><strong>Choose time</strong><span>{draftHour}:{draftMinute}</span></header>
          <div className="member-event-time-columns">
            <div ref={hourListRef} role="listbox" aria-label="Hour">{HOURS.map(hour => <button type="button" role="option" aria-selected={draftHour === hour} className={draftHour === hour ? 'selected' : ''} key={hour} onClick={() => setDraftHour(hour)}>{hour}</button>)}</div>
            <div ref={minuteListRef} role="listbox" aria-label="Minute">{MINUTES.map(minute => <button type="button" role="option" aria-selected={draftMinute === minute} className={draftMinute === minute ? 'selected' : ''} key={minute} onClick={() => setDraftMinute(minute)}>{minute}</button>)}</div>
          </div>
          <footer><button type="button" onClick={() => { setValue(''); setOpen(false) }}>Clear</button><button className="primary" type="button" onClick={() => { setValue(`${draftHour}:${draftMinute}`); setOpen(false) }}><Check size={15} /> Set time</button></footer>
        </>}
      </div>}
    </div>
  </label>
}
