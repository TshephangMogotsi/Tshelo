'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BellRing, ChevronLeft, ChevronRight, CircleCheck, Clipboard, Download, Eye, FileText, HandCoins, Image as ImageIcon, MapPin, Paperclip, Pencil, Plus, RefreshCw, Settings, WalletCards, X, ZoomIn, ZoomOut } from 'lucide-react'
import {
  EVENT_ANNOUNCEMENT_ATTACHMENT_MEDIA_TYPES,
  EVENT_ANNOUNCEMENT_MAX_ATTACHMENT_BYTES,
  EVENT_ANNOUNCEMENT_MAX_ATTACHMENTS,
} from '@shared/contracts'
import type { EventAnnouncement, EventAnnouncementAttachment, EventWorkspace, UpdateEventRequest } from '@shared/contracts'
import { invitationUrl } from '@shared/invitations'
import { StatusPill } from '@/components/status-pill'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import { normalizeEventTime } from '@/lib/event-form'
import { formatDate, formatMoney, titleCase } from '@/lib/format'
import { invalidateHomeSummary } from '@/lib/home-summary-cache'
import { EventGuests } from './event-guests'

type EventWorkspaceTab = 'overview' | 'guests' | 'announcements' | 'budget' | 'settings'

const eventWorkspaceTabs: Array<{ id: EventWorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'guests', label: 'Guests' },
  { id: 'announcements', label: 'Updates' },
  { id: 'budget', label: 'Budget' },
  { id: 'settings', label: 'Settings' },
]

const MIN_ATTACHMENT_ZOOM = 1
const MAX_ATTACHMENT_ZOOM = 3
const ATTACHMENT_ZOOM_STEP = .25

function formatFileSize(sizeBytes: number) {
  return sizeBytes >= 1024 * 1024
    ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
}

function announcementTimelineDate(value: string) {
  const date = new Date(value)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  return {
    label: isToday ? 'Today' : new Intl.DateTimeFormat('en-BW', { day: '2-digit', month: 'short' }).format(date),
    detail: isToday
      ? new Intl.DateTimeFormat('en-BW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
      : String(date.getFullYear()),
  }
}

function Summary({ workspace }: { workspace: EventWorkspace }) {
  const event = workspace.event
  const confirmed = workspace.guests.filter(guest => guest.rsvp_status === 'yes').reduce((sum, guest) => sum + 1 + guest.plus_ones, 0)
  const pending = workspace.guests.filter(guest => guest.rsvp_status === 'pending' || guest.rsvp_status === 'maybe').length
  const guestCount = workspace.guests.reduce((sum, guest) => sum + 1 + guest.plus_ones, 0)
  const schedule = [event.event_time, event.event_end_time].filter(Boolean).join(' – ') || 'Time to be confirmed'

  return <section className="member-card member-fund-overview">
    <div className="member-fund-overview-head">
      <div className="member-workspace-emoji" aria-hidden="true">{event.event_emoji ?? '🎉'}</div>
      <div className="member-workspace-copy"><span>{titleCase(event.event_type)} · {event.event_code}</span><h2>{event.name}</h2><p>{event.description || 'No description has been added yet.'}</p></div>
      <StatusPill value={event.status} />
    </div>
    <div className="member-fund-overview-metrics">
      <section className="member-fund-goal-card" aria-label="Event schedule">
        <div className="member-fund-goal-heading"><div><span>Event date</span><strong>{formatDate(event.event_date)}</strong></div><b>{titleCase(event.status)}</b></div>
        <dl className="member-fund-goal-details"><div><dt>Venue</dt><dd>{event.venue_name || 'To be confirmed'}</dd></div><div><dt>Time</dt><dd>{schedule}</dd></div></dl>
      </section>
      <div className="member-fund-metric-grid" aria-label="Event metrics">
        <article><span>Confirmed</span><strong>{confirmed}</strong><small>Guests attending</small></article>
        <article><span>Awaiting RSVP</span><strong>{pending}</strong><small>Need a response</small></article>
        <article><span>Guest list</span><strong>{guestCount}</strong><small>People invited</small></article>
        <article><span>Budget</span><strong>{workspace.budget ? formatMoney(workspace.budget.total_budget, workspace.budget.currency_code) : '—'}</strong><small>Planned event spend</small></article>
      </div>
    </div>
    <div className="member-event-location"><MapPin size={16} /><div><strong>{event.venue_name || 'Venue to be confirmed'}</strong><span>{event.venue_address || schedule}</span></div></div>
  </section>
}

function AnnouncementComposer({ workspace, announcement, reload, onClose }: { workspace: EventWorkspace; announcement?: EventAnnouncement; reload: () => void; onClose: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const initialAttachmentPaths = useRef(new Set((announcement?.attachments ?? []).map(attachment => attachment.object_path)))
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [attachments, setAttachments] = useState<EventAnnouncementAttachment[]>(() => announcement?.attachments ?? []); const [error, setError] = useState('')
  const editing = Boolean(announcement)

  async function selectAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    if (attachments.length + files.length > EVENT_ANNOUNCEMENT_MAX_ATTACHMENTS) {
      setError(`You can attach up to ${EVENT_ANNOUNCEMENT_MAX_ATTACHMENTS} files to an announcement.`)
      return
    }
    const invalid = files.find(file => !EVENT_ANNOUNCEMENT_ATTACHMENT_MEDIA_TYPES.includes(file.type as typeof EVENT_ANNOUNCEMENT_ATTACHMENT_MEDIA_TYPES[number]) || file.size > EVENT_ANNOUNCEMENT_MAX_ATTACHMENT_BYTES)
    if (invalid) {
      setError(`${invalid.name} must be a PDF, JPG, PNG, or WEBP image no larger than 10 MB.`)
      return
    }

    setUploading(true); setError('')
    try {
      const uploaded = await Promise.all(files.map(async file => {
        const session = await createApiClient().events.createAnnouncementUploadSession(workspace.event.id, {
          file_name: file.name,
          content_type: file.type as EventAnnouncementAttachment['content_type'],
          size_bytes: file.size,
        })
        const upload = await fetch(session.upload_url, {
          method: 'PUT',
          headers: { 'cache-control': 'max-age=3600', 'content-type': session.content_type, 'x-upsert': 'false' },
          body: file,
        })
        if (!upload.ok) throw new Error(`Could not upload ${file.name}.`)
        return { object_path: session.object_path, file_name: session.file_name, content_type: session.content_type, size_bytes: session.size_bytes }
      }))
      setAttachments(current => [...current, ...uploaded])
    } catch (cause) { setError(apiErrorMessage(cause)) }
    finally { setUploading(false) }
  }

  async function removeAttachment(attachment: EventAnnouncementAttachment) {
    setError('')
    if (initialAttachmentPaths.current.has(attachment.object_path)) {
      setAttachments(current => current.filter(item => item.object_path !== attachment.object_path))
      return
    }
    try { await createApiClient().events.deleteAnnouncementUpload(workspace.event.id, { object_path: attachment.object_path }) }
    catch { setError('The attachment could not be removed. Please try again.'); return }
    setAttachments(current => current.filter(item => item.object_path !== attachment.object_path))
  }

  async function cancel() {
    if (busy || uploading) return
    const unsavedPaths = attachments.filter(attachment => !initialAttachmentPaths.current.has(attachment.object_path)).map(attachment => attachment.object_path)
    if (unsavedPaths.length > 0) await Promise.all(unsavedPaths.map(objectPath => createApiClient().events.deleteAnnouncementUpload(workspace.event.id, { object_path: objectPath }).catch(() => null)))
    onClose()
  }

  async function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (uploading) return; const form = new FormData(event.currentTarget); setBusy(true); setError('')
    const input = { title: String(form.get('title') ?? '').trim(), body: String(form.get('body') ?? '').trim() }
    try {
      if (announcement) await createApiClient().events.updateAnnouncement(workspace.event.id, announcement.id, { ...input, attachments })
      else await createApiClient().events.createAnnouncement(workspace.event.id, { ...input, attachments })
      setBusy(false); reload(); onClose()
    }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy(false) }
  }

  return <div className="tshelo-dashboard modal-root">
    <div className="overlay on" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) void cancel() }}>
      <section className="modal member-announcement-dialog" role="dialog" aria-modal="true" aria-labelledby="announcement-dialog-title">
        <header>
          <span className="itile sm">{editing ? <Pencil size={18} aria-hidden="true" /> : <BellRing size={18} aria-hidden="true" />}</span>
          <h3 id="announcement-dialog-title">{editing ? 'Edit announcement' : 'Create announcement'}</h3>
          <button className="x" type="button" onClick={() => void cancel()} disabled={busy || uploading} aria-label={`Close ${editing ? 'announcement editor' : 'announcement composer'}`}><X size={20} /></button>
        </header>
        <form className="member-announcement-form member-announcement-dialog-form" onSubmit={post}>
          <div className="mbody">
            <label><span>Announcement title</span><input name="title" required minLength={3} maxLength={120} placeholder="Announcement title" defaultValue={announcement?.title} autoFocus /></label>
            <label><span>Message</span><textarea name="body" required minLength={3} maxLength={4000} rows={5} placeholder="Write an update for everyone attending…" defaultValue={announcement?.body} /></label>
            <div className="member-announcement-file-picker">
              <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple onChange={selectAttachments} disabled={busy || uploading} />
              <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || uploading}><Paperclip size={14} /> {uploading ? 'Uploading files…' : 'Add files'}</button>
              <span>PDF, JPG, PNG, or WEBP · up to 10 MB each</span>
            </div>
            {attachments.length > 0 && <ul className="member-announcement-pending-files">{attachments.map(attachment => <li key={attachment.object_path}><span>{attachment.content_type === 'application/pdf' ? <FileText size={15} /> : <ImageIcon size={15} />}</span><div><strong>{attachment.file_name}</strong><small>{formatFileSize(attachment.size_bytes)}</small></div><button type="button" aria-label={`Remove ${attachment.file_name}`} onClick={() => removeAttachment(attachment)} disabled={busy || uploading}><X size={14} /></button></li>)}</ul>}
            {error && <p className="member-form-error" role="alert">{error}</p>}
          </div>
          <footer>
            <button className="btn ghost" type="button" onClick={() => void cancel()} disabled={busy || uploading}>Cancel</button>
            <button className="btn purple" type="submit" disabled={busy || uploading}>{busy ? (editing ? 'Saving…' : 'Posting…') : (editing ? 'Save changes' : 'Post announcement')}</button>
          </footer>
        </form>
      </section>
    </div>
  </div>
}

function AnnouncementFiles({ eventId, attachments }: { eventId: string; attachments: EventAnnouncementAttachment[] }) {
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ attachment: EventAnnouncementAttachment; url: string } | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [zoom, setZoom] = useState(MIN_ATTACHMENT_ZOOM)

  async function signedUrlFor(attachment: EventAnnouncementAttachment) {
    const access = await createApiClient().events.createAnnouncementAttachmentAccess(eventId, { object_path: attachment.object_path })
    return access.download_url
  }

  async function previewAttachment(attachment: EventAnnouncementAttachment) {
    setError(''); setLoadingPath(attachment.object_path)
    try {
      const signedUrls = Object.fromEntries(await Promise.all(attachments.map(async item => [item.object_path, await signedUrlFor(item)] as const)))
      setPreviewUrls(signedUrls)
      setPreview({ attachment, url: signedUrls[attachment.object_path] })
      setZoom(MIN_ATTACHMENT_ZOOM)
    }
    catch (cause) { setError(apiErrorMessage(cause)) }
    finally { setLoadingPath(null) }
  }

  function closePreview() {
    setPreview(null)
    setPreviewUrls({})
    setZoom(MIN_ATTACHMENT_ZOOM)
  }

  function selectPreview(attachment: EventAnnouncementAttachment) {
    const url = previewUrls[attachment.object_path]
    if (url) { setPreview({ attachment, url }); setZoom(MIN_ATTACHMENT_ZOOM) }
  }

  function stepPreview(direction: -1 | 1) {
    if (!preview || attachments.length < 2) return
    const currentIndex = attachments.findIndex(item => item.object_path === preview.attachment.object_path)
    selectPreview(attachments[(currentIndex + direction + attachments.length) % attachments.length])
  }

  async function downloadAttachment(attachment: EventAnnouncementAttachment) {
    setError(''); setLoadingPath(attachment.object_path)
    try {
      const response = await fetch(await signedUrlFor(attachment))
      if (!response.ok) throw new Error('This attachment could not be downloaded.')
      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = attachment.file_name
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch (cause) { setError(apiErrorMessage(cause)) }
    finally { setLoadingPath(null) }
  }

  if (!attachments.length) return null
  const previewIndex = preview ? attachments.findIndex(item => item.object_path === preview.attachment.object_path) : -1
  const previewIsImage = preview?.attachment.content_type !== 'application/pdf'

  return <div className="member-announcement-files">
    <div>{attachments.map(attachment => <div className="member-announcement-file" key={attachment.object_path}>
      <div className="member-announcement-file-details">{attachment.content_type === 'application/pdf' ? <FileText size={14} /> : <ImageIcon size={14} />}<span>{attachment.file_name}</span><small>{formatFileSize(attachment.size_bytes)}</small></div>
      <div className="member-announcement-file-actions">
        <button type="button" onClick={() => previewAttachment(attachment)} disabled={loadingPath === attachment.object_path} aria-label={`Preview ${attachment.file_name}`} title="Preview"><Eye size={14} /></button>
        <button type="button" onClick={() => downloadAttachment(attachment)} disabled={loadingPath === attachment.object_path} aria-label={`Download ${attachment.file_name}`} title="Download"><Download size={14} /></button>
      </div>
    </div>)}</div>
    {error && <p className="member-form-error" role="alert">{error}</p>}
    {preview && <div className="tshelo-dashboard modal-root">
      <div className="overlay on member-announcement-viewer-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closePreview() }}>
        <section className="member-announcement-viewer" role="dialog" aria-modal="true" aria-labelledby="announcement-preview-title">
          <header className="member-announcement-viewer-header">
            <div><strong id="announcement-preview-title">{preview.attachment.file_name}</strong>{attachments.length > 1 && <span>{previewIsImage ? 'Image' : 'File'} {previewIndex + 1} of {attachments.length}</span>}</div>
            <div className="member-announcement-viewer-actions">{previewIsImage && <><button type="button" onClick={() => setZoom(current => Math.max(MIN_ATTACHMENT_ZOOM, current - ATTACHMENT_ZOOM_STEP))} disabled={zoom <= MIN_ATTACHMENT_ZOOM} aria-label="Zoom out" title="Zoom out"><ZoomOut size={18} /></button><button type="button" onClick={() => setZoom(current => Math.min(MAX_ATTACHMENT_ZOOM, current + ATTACHMENT_ZOOM_STEP))} disabled={zoom >= MAX_ATTACHMENT_ZOOM} aria-label="Zoom in" title="Zoom in"><ZoomIn size={18} /></button></>}<button type="button" onClick={() => downloadAttachment(preview.attachment)} disabled={loadingPath === preview.attachment.object_path} aria-label={`Download ${preview.attachment.file_name}`} title="Download"><Download size={18} /></button><button type="button" onClick={closePreview} aria-label="Close attachment preview" title="Close"><X size={20} /></button></div>
          </header>
          <div className="member-announcement-viewer-stage">
            {attachments.length > 1 && <button className="member-announcement-viewer-nav previous" type="button" onClick={() => stepPreview(-1)} aria-label="Previous attachment"><ChevronLeft size={22} /></button>}
            {preview.attachment.content_type === 'application/pdf'
              ? <iframe src={preview.url} title={`Preview of ${preview.attachment.file_name}`} />
              : <>
                {/* A short-lived private storage URL cannot use Next's image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt={`Preview of ${preview.attachment.file_name}`} style={{ transform: `scale(${zoom})` }} />
              </>}
            {attachments.length > 1 && <button className="member-announcement-viewer-nav next" type="button" onClick={() => stepPreview(1)} aria-label="Next attachment"><ChevronRight size={22} /></button>}
          </div>
          {attachments.length > 1 && <footer className="member-announcement-viewer-filmstrip">{attachments.map((attachment, index) => <button key={attachment.object_path} type="button" className={attachment.object_path === preview.attachment.object_path ? 'selected' : ''} onClick={() => selectPreview(attachment)} aria-label={`View ${attachment.file_name}`} aria-current={attachment.object_path === preview.attachment.object_path ? 'true' : undefined}>{attachment.content_type === 'application/pdf' ? <FileText size={20} /> : <span style={{ backgroundImage: `url("${previewUrls[attachment.object_path]}")` }} />}<small>{index + 1}</small></button>)}</footer>}
        </section>
      </div>
    </div>}
  </div>
}

function Announcements({ workspace, reload }: { workspace: EventWorkspace; reload: () => void }) {
  const canPost = workspace.event.status === 'active' && (workspace.capabilities.is_creator || workspace.capabilities.is_organiser || workspace.capabilities.linked_fund_permissions.includes('post_event_announcements'))
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<EventAnnouncement | null>(null)
  const openComposer = () => { setEditingAnnouncement(null); setComposerOpen(true) }

  return <>
    <section className="member-card" id="announcements">
      <header>
        <div className="member-section-title"><span><BellRing size={18} /></span><h2>Announcements</h2></div>
        {canPost && workspace.announcements.length > 0 && <button className="member-announcement-create" type="button" onClick={openComposer}><Plus size={15} /> Create announcement</button>}
      </header>
      <div className="member-card-body member-events-workspace">
        {workspace.announcements.length > 0
          ? <div className="member-announcements">{workspace.announcements.map(item => {
            const date = announcementTimelineDate(item.created_at)
            return <article key={item.id}>
              <time className="member-announcement-date" dateTime={item.created_at}><span>{date.label}</span><b>{date.detail}</b></time>
              <div className="member-announcement-content"><div className="member-announcement-heading"><strong>{item.title}</strong>{canPost && <button type="button" onClick={() => { setComposerOpen(false); setEditingAnnouncement(item) }} aria-label={`Edit ${item.title}`} title="Edit announcement"><Pencil size={13} /></button>}</div><p title={item.body}>{item.body}</p><AnnouncementFiles eventId={workspace.event.id} attachments={item.attachments} /></div>
            </article>
          })}</div>
          : <div className="member-announcement-empty"><strong>No announcements yet</strong><p>Updates for guests will appear here.</p>{canPost && <button className="member-announcement-create" type="button" onClick={openComposer}><Plus size={15} /> Create announcement</button>}</div>}
      </div>
    </section>
    {composerOpen && <AnnouncementComposer workspace={workspace} reload={reload} onClose={() => setComposerOpen(false)} />}
    {editingAnnouncement && <AnnouncementComposer workspace={workspace} announcement={editingAnnouncement} reload={reload} onClose={() => setEditingAnnouncement(null)} />}
  </>
}

function EventBudgetPanel({ workspace, reload }: { workspace: EventWorkspace; reload: () => void }) {
  const linkedFund = workspace.linked_fund
  const canManage = workspace.event.status === 'active' && Boolean(workspace.event.linked_fund_id) && (workspace.capabilities.is_creator || workspace.capabilities.is_organiser || workspace.capabilities.linked_fund_permissions.includes('manage_event_budget')) && (!linkedFund || linkedFund.fund.status === 'active')
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('')
    try { await createApiClient().events.updateBudget(workspace.event.id, { total_budget: String(form.get('total_budget') ?? '').trim(), currency_code: String(form.get('currency_code') ?? workspace.event.currency_code) }); setBusy(false); reload() }
    catch (cause) { setError(apiErrorMessage(cause)); setBusy(false) }
  }
  return <section className="member-card" id="budget"><header><div className="member-section-title"><span><WalletCards size={18} /></span><h2>Event budget</h2></div>{workspace.event.linked_fund_id && <Link href={`/account/funds/${workspace.event.linked_fund_id}` as never}>Open linked fund</Link>}</header><div className="member-card-body">{workspace.event.linked_fund_id ? <><form className="member-budget-form" onSubmit={save}><label><span>Total budget</span><input name="total_budget" type="number" min="0" step="0.01" required defaultValue={workspace.budget?.total_budget ?? ''} disabled={!canManage} /></label><label><span>Currency</span><select name="currency_code" defaultValue={workspace.budget?.currency_code ?? workspace.event.currency_code} disabled={!canManage}><option value="BWP">BWP</option><option value="ZAR">ZAR</option><option value="USD">USD</option></select></label>{canManage && <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save budget'}</button>}</form>{linkedFund && <div className="member-event-fund-summary"><div><span>Contribution goal</span><strong>{formatMoney(linkedFund.fund.goal_amount, linkedFund.fund.currency_code)}</strong></div><div><span>Raised</span><strong>{formatMoney(linkedFund.fund.totals.raised, linkedFund.fund.currency_code)}</strong></div><div><span>Available</span><strong>{formatMoney(linkedFund.fund.totals.balance, linkedFund.fund.currency_code)}</strong></div></div>}</> : <div className="member-empty">This event does not have a linked contribution fund, so it does not use a shared event budget.</div>}{error && <p className="member-form-error" role="alert">{error}</p>}</div></section>
}

function EventSettings({ workspace, reload }: { workspace: EventWorkspace; reload: () => void }) {
  const router = useRouter(); const event = workspace.event
  const canManage = event.status === 'active' && (workspace.capabilities.is_creator || workspace.capabilities.is_organiser)
  const canInvite = event.status === 'active' && canManage
  const code = event.share_code || event.event_code
  const inviteUrl = invitationUrl('event', code)
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [copied, setCopied] = useState(false)
  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); const form = new FormData(formEvent.currentTarget)
    const request: UpdateEventRequest = { name: String(form.get('name') ?? '').trim(), description: String(form.get('description') ?? '').trim() || null, event_date: String(form.get('event_date') ?? ''), event_time: normalizeEventTime(form.get('event_time')), event_end_date: String(form.get('event_end_date') ?? '') || null, event_end_time: normalizeEventTime(form.get('event_end_time')), venue_name: String(form.get('venue_name') ?? '').trim() || null, venue_address: String(form.get('venue_address') ?? '').trim() || null }
    setBusy('save'); setError(''); try { await createApiClient().events.update(event.id, request); invalidateHomeSummary(); setBusy(''); reload() } catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }
  async function invite(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); const formElement = formEvent.currentTarget; const form = new FormData(formElement); const raw = String(form.get('phone') ?? '').trim(); const digits = raw.replace(/\D/g, ''); const phone = raw.startsWith('+') ? `+${digits}` : digits.length === 8 ? `+267${digits}` : `+${digits}`
    setBusy('invite'); setError(''); try { await createApiClient().events.inviteOrganiser(event.id, { name: String(form.get('name') ?? '').trim(), phone }); formElement.reset(); setBusy('') } catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }
  async function complete() {
    const amount = window.prompt('Estimated final spend (optional)', event.estimated_spend_amount ?? '')
    if (amount === null || !window.confirm('Mark this event as completed?')) return
    setBusy('complete'); setError(''); try { await createApiClient().events.complete(event.id, { estimated_spend_amount: amount.trim() || null }); invalidateHomeSummary(); setBusy(''); reload() } catch (cause) { setError(apiErrorMessage(cause)); setBusy('') }
  }
  async function leave() { if (!window.confirm('Leave this event? You will need the invitation code to rejoin.')) return; setBusy('leave'); setError(''); try { await createApiClient().events.leave(event.id); invalidateHomeSummary(); router.replace('/account/events') } catch (cause) { setError(apiErrorMessage(cause)); setBusy('') } }
  async function remove() { if (!window.confirm('Delete this event? It will disappear for everyone and cannot be restored from the website.')) return; setBusy('delete'); setError(''); try { await createApiClient().events.remove(event.id); invalidateHomeSummary(); router.replace('/account/events') } catch (cause) { setError(apiErrorMessage(cause)); setBusy('') } }
  async function copy() { try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { setError('The invitation link could not be copied. Select and copy the code manually.') } }
  return <section className="member-card" id="settings"><header><div className="member-section-title"><span><Settings size={18} /></span><h2>{canManage ? 'Event settings' : 'Attendance'}</h2></div></header><div className="member-card-body">{canInvite && <div className="member-invite-code"><div><span>Invitation code</span><strong>{code}</strong><small>Anyone with this link can review and join the event guest list.</small></div><button type="button" onClick={copy}><Clipboard size={14} /> {copied ? 'Copied' : 'Copy link'}</button></div>}{canInvite && <form className="member-organiser-form" onSubmit={invite}><label><span>Co-organiser name</span><input name="name" required maxLength={100} /></label><label><span>Phone</span><input name="phone" type="tel" required placeholder="+267 71 234 567" /></label><button type="submit" disabled={Boolean(busy)}>{busy === 'invite' ? 'Sending…' : 'Invite organiser'}</button></form>}{canManage ? <form className="member-form member-settings-form" onSubmit={save}><div className="member-form-grid"><label className="wide"><span>Event name</span><input name="name" required minLength={3} maxLength={200} defaultValue={event.name} /></label><label><span>Date</span><input name="event_date" type="date" required defaultValue={event.event_date} /></label><label><span>Start time</span><input name="event_time" type="time" defaultValue={event.event_time ?? ''} /></label><label><span>End date</span><input name="event_end_date" type="date" defaultValue={event.event_end_date ?? ''} /></label><label><span>End time</span><input name="event_end_time" type="time" defaultValue={event.event_end_time ?? ''} /></label><label><span>Venue</span><input name="venue_name" maxLength={200} defaultValue={event.venue_name ?? ''} /></label><label><span>Address or Maps link</span><input name="venue_address" maxLength={2000} defaultValue={event.venue_address ?? ''} /></label><label className="wide"><span>Description</span><textarea name="description" rows={4} maxLength={4000} defaultValue={event.description ?? ''} /></label></div><div className="member-form-actions">{workspace.capabilities.is_creator && !event.linked_fund_id && <button type="button" className="danger" onClick={remove} disabled={Boolean(busy)}>{busy === 'delete' ? 'Deleting…' : 'Delete event'}</button>}{event.status === 'active' && !event.linked_fund_id && <button type="button" onClick={complete} disabled={Boolean(busy)}>{busy === 'complete' ? 'Completing…' : 'Complete event'}</button>}<button className="primary" type="submit" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button></div></form> : workspace.capabilities.can_leave_event ? <div className="member-form-actions"><button className="danger" type="button" onClick={leave} disabled={Boolean(busy)}>{busy === 'leave' ? 'Leaving…' : 'Leave event'}</button></div> : null}{error && <p className="member-form-error" role="alert">{error}</p>}</div></section>
}

export function EventWorkspaceView({ eventId }: { eventId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams(); const [workspace, setWorkspace] = useState<EventWorkspace | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [version, setVersion] = useState(0)
  const reload = useCallback(() => { invalidateHomeSummary(); setError(''); setVersion(value => value + 1) }, [])
  useEffect(() => { const controller = new AbortController(); runApiRead(call => createApiClient().events.workspace(eventId, call), controller.signal).then(setWorkspace).catch(cause => { const message = apiErrorMessage(cause); if (message) setError(message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) }); return () => controller.abort() }, [eventId, version])
  const notice = useMemo(() => searchParams.get('created') === '1' ? 'Event created. Share its invitation code when you are ready.' : searchParams.get('joined') === '1' ? 'You joined this event successfully.' : '', [searchParams])
  const requestedTab = searchParams.get('tab')
  const activeTab: EventWorkspaceTab = eventWorkspaceTabs.some(tab => tab.id === requestedTab) ? requestedTab as EventWorkspaceTab : 'overview'

  function selectTab(tab: EventWorkspaceTab) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'overview') params.delete('tab')
    else params.set('tab', tab)
    const query = params.toString()
    router.replace((query ? `${pathname}?${query}` : pathname) as never, { scroll: false })
  }

  if (loading) return <section className="member-card"><div className="member-empty">Loading event workspace…</div></section>
  if (!workspace) return <section className="member-card"><div className="member-api-state error"><p>{error || 'This event could not be loaded.'}</p><div><button type="button" onClick={reload}><RefreshCw size={14} /> Try again</button><Link href="/account/events">Back to events</Link></div></div></section>
  const canManageGuests = workspace.capabilities.is_creator
    || workspace.capabilities.is_organiser
    || workspace.capabilities.linked_fund_permissions.includes('manage_event_guests')
  return <>
    <section className="member-pagehead">
      <div>
        <nav className="fund-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/account/events">My events</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{workspace.event.name}</span>
        </nav>
        <h1>Event <em>workspace</em></h1>
      </div>
    </section>

    {notice && <p className="member-success-note"><CircleCheck size={16} /> {notice}</p>}
    {error && <p className="member-form-error" role="alert">{error}</p>}

    <div className="fund-workspace-tab-view">
      <nav className="fund-workspace-tabs" role="tablist" aria-label="Event workspace sections">
        {eventWorkspaceTabs.map(tab => <button
          key={tab.id}
          id={`event-workspace-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls="event-workspace-panel"
          className={activeTab === tab.id ? 'active' : ''}
          onClick={() => selectTab(tab.id)}
        >{tab.id === 'guests' && !canManageGuests ? 'RSVP' : tab.label}</button>)}
      </nav>

      <div id="event-workspace-panel" role="tabpanel" aria-labelledby={`event-workspace-tab-${activeTab}`}>
        {activeTab === 'overview' && <>
          <Summary workspace={workspace} />
          {workspace.event.linked_fund_id && <section className="member-event-linked"><HandCoins size={18} /><div><strong>Event + Fund workspace</strong><span>Contributions, expenses, members and sponsorships live in the linked fund.</span></div><Link href={`/account/funds/${workspace.event.linked_fund_id}` as never}>Manage fund</Link></section>}
        </>}
        {activeTab === 'guests' && <EventGuests workspace={workspace} reloadWorkspace={reload} />}
        {activeTab === 'announcements' && <Announcements workspace={workspace} reload={reload} />}
        {activeTab === 'budget' && <EventBudgetPanel workspace={workspace} reload={reload} />}
        {activeTab === 'settings' && <EventSettings workspace={workspace} reload={reload} />}
      </div>
    </div>
  </>
}
