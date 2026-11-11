'use client'

import { useState } from 'react'
import { Check, ChevronDown, CircleAlert, LoaderCircle, PencilLine } from 'lucide-react'
import type { SupportTicketPriority, SupportTicketStatus, SupportTicketSummary } from '@shared/contracts/admin'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage } from '@/lib/api-ui'
import { formatDate, titleCase } from '@/lib/format'
import { StatusPill } from '@/components/status-pill'

type Props = {
  tickets: SupportTicketSummary[]
  hasError: boolean
  canManage: boolean
  query: string
}

type TicketDraft = {
  status: SupportTicketStatus
  priority: SupportTicketPriority
  assignedTo: string
  resolutionNote: string
}

const STATUSES: SupportTicketStatus[] = ['open', 'pending', 'in_progress', 'resolved', 'closed']
const PRIORITIES: SupportTicketPriority[] = ['low', 'normal', 'high', 'urgent']

function initialDraft(ticket: SupportTicketSummary): TicketDraft {
  return {
    status: ticket.status,
    priority: ticket.priority,
    assignedTo: ticket.assigned_to ?? '',
    resolutionNote: ticket.resolution_note ?? '',
  }
}

export function SupportQueue({ tickets: initialTickets, hasError, canManage, query }: Props) {
  const [tickets, setTickets] = useState(initialTickets)
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, TicketDraft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  function draftFor(ticket: SupportTicketSummary) {
    return drafts[ticket.id] ?? initialDraft(ticket)
  }

  function openTicket(ticket: SupportTicketSummary) {
    setActiveTicketId(previous => previous === ticket.id ? null : ticket.id)
    setDrafts(previous => previous[ticket.id] ? previous : { ...previous, [ticket.id]: initialDraft(ticket) })
    setNotice('')
    setError('')
  }

  function updateDraft(ticket: SupportTicketSummary, patch: Partial<TicketDraft>) {
    setDrafts(previous => ({ ...previous, [ticket.id]: { ...draftFor(ticket), ...patch } }))
  }

  async function save(ticket: SupportTicketSummary) {
    const draft = draftFor(ticket)
    setSavingId(ticket.id)
    setError('')
    setNotice('')
    try {
      const updated = await createApiClient().admin.updateSupportTicket({
        ticket_id: ticket.id,
        status: draft.status,
        priority: draft.priority,
        assigned_to: draft.assignedTo.trim() || null,
        resolution_note: draft.resolutionNote.trim() || null,
      })
      setTickets(previous => previous.map(item => item.id === ticket.id ? {
        ...item,
        ...updated,
        resolution_note: draft.resolutionNote.trim() || null,
      } : item))
      setNotice(`${ticket.ticket_number} updated.`)
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="panel data-panel support-queue">
      <div className="panel-heading">
        <div>
          <h3>{query ? `Results for “${query}”` : 'Support queue'}</h3>
          <p>{canManage ? 'Open a report to assign it, update its status, and record the resolution.' : 'Newest member reports appear first. Your role can view but not change reports.'}</p>
        </div>
        <span className="support-queue-count">{tickets.length} shown</span>
      </div>

      {notice && <p className="support-queue-notice" role="status"><Check size={16} /> {notice}</p>}
      {error && <p className="support-queue-error" role="alert"><CircleAlert size={16} /> {error}</p>}

      {!tickets.length ? (
        <div className="table-empty">{hasError ? 'Support data could not be loaded.' : 'No matching reports.'}</div>
      ) : (
        <div className="support-ticket-list">
          {tickets.map(ticket => {
            const active = activeTicketId === ticket.id
            const draft = draftFor(ticket)
            const saving = savingId === ticket.id
            return (
              <article className={`support-ticket ${active ? 'open' : ''}`} key={ticket.id}>
                <button className="support-ticket-summary" type="button" onClick={() => openTicket(ticket)} aria-expanded={active}>
                  <span className="support-ticket-number">{ticket.ticket_number}</span>
                  <span className="support-ticket-main"><strong>{ticket.subject}</strong><small>{titleCase(ticket.category).replace(/_/g, ' · ')} · {formatDate(ticket.created_at)}</small></span>
                  <span className="support-ticket-pills"><StatusPill value={ticket.priority} /><StatusPill value={ticket.status} /></span>
                  <ChevronDown size={18} aria-hidden />
                </button>

                {active && (
                  <div className="support-ticket-detail">
                    <div className="support-ticket-message">
                      <h4>Member report</h4>
                      <p>{ticket.description || 'No description was provided.'}</p>
                    </div>
                    {canManage ? (
                      <div className="support-ticket-form">
                        <label><span>Status</span><select value={draft.status} onChange={event => updateDraft(ticket, { status: event.target.value as SupportTicketStatus })}>{STATUSES.map(status => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
                        <label><span>Priority</span><select value={draft.priority} onChange={event => updateDraft(ticket, { priority: event.target.value as SupportTicketPriority })}>{PRIORITIES.map(priority => <option key={priority} value={priority}>{titleCase(priority)}</option>)}</select></label>
                        <label className="support-ticket-wide"><span>Assigned to</span><input value={draft.assignedTo} onChange={event => updateDraft(ticket, { assignedTo: event.target.value })} maxLength={100} placeholder="Team member or queue" /></label>
                        <label className="support-ticket-wide"><span>Resolution note</span><textarea value={draft.resolutionNote} onChange={event => updateDraft(ticket, { resolutionNote: event.target.value.slice(0, 4000) })} maxLength={4000} rows={4} placeholder="What was checked, changed, or shared with the member" /></label>
                        <button className="support-ticket-save" type="button" onClick={() => void save(ticket)} disabled={saving}>{saving ? <LoaderCircle className="support-ticket-spinner" size={15} /> : <PencilLine size={15} />}{saving ? 'Saving…' : 'Save changes'}</button>
                      </div>
                    ) : ticket.resolution_note ? (
                      <div className="support-ticket-resolution"><h4>Resolution note</h4><p>{ticket.resolution_note}</p></div>
                    ) : null}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
