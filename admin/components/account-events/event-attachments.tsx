'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Download, Eye, FileText, Image as ImageIcon, LoaderCircle, RefreshCw, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { EventFile } from '@shared/contracts'
import { formatEventFileSize } from '@shared/event-files'
import { apiErrorMessage } from '@/lib/api-ui'
import { eventAttachmentUrl, type EventAttachment } from './event-attachment-access'

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = .25

function PrivateThumbnail({ eventId, attachment, compact = false, onPreview, disabled }: { eventId: string; attachment: EventAttachment; compact?: boolean; onPreview?: () => void; disabled?: boolean }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void eventAttachmentUrl(eventId, attachment, controller.signal)
      .then(value => { if (!controller.signal.aborted) setUrl(value) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [eventId, attachment, attempt])
  if (failed) return compact ? <ImageIcon size={20} /> : <div className="member-event-file-thumbnail-failed"><ImageIcon size={24} aria-hidden="true" /><span>Preview unavailable</span><button type="button" onClick={() => { setFailed(false); setUrl(''); setAttempt(value => value + 1) }} aria-label={`Retry thumbnail for ${attachment.file_name}`}><RefreshCw size={14} /> Retry</button></div>
  // Bypass the optimizer: these are private, short-lived URLs, not public cached images.
  if (!url) return <span className="member-event-file-loading" role="status" aria-label={`Loading thumbnail for ${attachment.file_name}`}><LoaderCircle size={22} aria-hidden="true" /></span>
  const image = <Image src={url} alt={compact ? '' : attachment.file_name} width={480} height={360} unoptimized onError={() => setFailed(true)} />
  return onPreview ? <button type="button" disabled={disabled} onClick={onPreview} aria-label={`Preview ${attachment.file_name}`}>{image}</button> : image
}

function ViewerDialog({ children, titleId, onClose }: { children: ReactNode; titleId: string; onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], iframe, [tabindex="0"]') ?? [])
      const first = controls[0]; const last = controls[controls.length - 1]
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [onClose])
  return createPortal(<div className="tshelo-dashboard modal-root"><div className="overlay on member-announcement-viewer-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section ref={dialog} tabIndex={-1} className="member-announcement-viewer" role="dialog" aria-modal="true" aria-labelledby={titleId}>{children}</section></div></div>, document.body)
}

/** The same viewer/download interaction serves update attachments and event-wide files. */
export function EventAttachments({ eventId, attachments, layout = 'rows', onRemove, busy = false }: {
  eventId: string
  attachments: EventAttachment[]
  layout?: 'rows' | 'gallery'
  onRemove?: (file: EventFile) => void
  busy?: boolean
}) {
  const titleId = useId()
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ attachment: EventAttachment; url: string } | null>(null)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [previewFailed, setPreviewFailed] = useState(false)
  const requestVersion = useRef(0)
  const locked = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestVersion.current += 1 } }, [])

  async function previewAttachment(attachment: EventAttachment) {
    if (locked.current) return
    locked.current = true
    const version = ++requestVersion.current
    setError(''); setLoadingPath(attachment.object_path)
    try {
      const url = await eventAttachmentUrl(eventId, attachment)
      if (!mounted.current || version !== requestVersion.current) return
      setPreview({ attachment, url }); setPreviewFailed(false); setZoom(MIN_ZOOM)
    } catch (cause) { if (mounted.current && version === requestVersion.current) setError(apiErrorMessage(cause)) }
    finally { locked.current = false; if (mounted.current) setLoadingPath(null) }
  }

  const closePreview = useCallback(() => {
    requestVersion.current += 1
    setPreview(null); setPreviewFailed(false); setZoom(MIN_ZOOM)
  }, [])

  function stepPreview(direction: -1 | 1) {
    if (!preview || attachments.length < 2) return
    const index = attachments.findIndex(item => item.object_path === preview.attachment.object_path)
    void previewAttachment(attachments[(index + direction + attachments.length) % attachments.length])
  }

  async function downloadAttachment(attachment: EventAttachment) {
    if (locked.current) return
    locked.current = true; setError(''); setLoadingPath(attachment.object_path)
    try {
      const response = await fetch(await eventAttachmentUrl(eventId, attachment))
      if (!response.ok) { if (mounted.current) setError('This attachment could not be downloaded. Please retry.'); return }
      const objectUrl = URL.createObjectURL(await response.blob())
      try {
        const link = document.createElement('a')
        link.href = objectUrl; link.download = attachment.file_name
        document.body.appendChild(link); link.click(); link.remove()
      } finally { window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0) }
    } catch (cause) { if (mounted.current) setError(apiErrorMessage(cause)) }
    finally { locked.current = false; if (mounted.current) setLoadingPath(null) }
  }

  if (!attachments.length) return null
  const index = preview ? attachments.findIndex(item => item.object_path === preview.attachment.object_path) : -1
  const isImage = preview?.attachment.content_type !== 'application/pdf'

  return <div className={layout === 'gallery' ? 'member-event-file-gallery' : 'member-announcement-files'}>
    <div className={layout === 'gallery' ? 'member-event-file-grid' : undefined}>{attachments.map(attachment => <div className={layout === 'gallery' ? 'member-event-file-image' : 'member-announcement-file'} key={attachment.object_path}>
      {layout === 'gallery' && <div className="member-event-file-thumbnail"><PrivateThumbnail eventId={eventId} attachment={attachment} onPreview={() => void previewAttachment(attachment)} disabled={loadingPath !== null} /></div>}
      <div className="member-announcement-file-details">{layout !== 'gallery' && (attachment.content_type === 'application/pdf' ? <FileText size={16} /> : <ImageIcon size={16} />)}<span title={attachment.file_name}>{attachment.file_name}</span><small>{formatEventFileSize(attachment.size_bytes)}</small></div>
      <div className="member-announcement-file-actions">
        <button type="button" onClick={() => void previewAttachment(attachment)} disabled={loadingPath !== null} aria-label={`Preview ${attachment.file_name}`} title="Preview"><Eye size={16} /></button>
        <button type="button" onClick={() => void downloadAttachment(attachment)} disabled={loadingPath !== null} aria-label={`Download ${attachment.file_name}`} title="Download"><Download size={16} /></button>
        {onRemove && 'id' in attachment && <button type="button" className="danger" onClick={() => onRemove(attachment)} disabled={busy || loadingPath !== null} aria-label={`Delete ${attachment.file_name}`} title="Delete"><Trash2 size={16} /></button>}
        {loadingPath === attachment.object_path && <span role="status" aria-label={`Opening ${attachment.file_name}`}><LoaderCircle size={16} /></span>}
      </div>
    </div>)}</div>
    {error && !preview && <p className="member-form-error" role="alert">{error}</p>}
    {preview && <ViewerDialog titleId={titleId} onClose={closePreview}>
      <header className="member-announcement-viewer-header">
        <div><strong id={titleId}>{preview.attachment.file_name}</strong>{attachments.length > 1 && <span>{isImage ? 'Image' : 'File'} {index + 1} of {attachments.length}</span>}</div>
        <div className="member-announcement-viewer-actions">{isImage && <><button type="button" onClick={() => setZoom(current => Math.max(MIN_ZOOM, current - ZOOM_STEP))} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" title="Zoom out"><ZoomOut size={18} /></button><button type="button" onClick={() => setZoom(current => Math.min(MAX_ZOOM, current + ZOOM_STEP))} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in"><ZoomIn size={18} /></button></>}<button type="button" onClick={() => void downloadAttachment(preview.attachment)} disabled={loadingPath !== null} aria-label={`Download ${preview.attachment.file_name}`} title="Download">{loadingPath ? <LoaderCircle size={18} /> : <Download size={18} />}</button><button type="button" onClick={closePreview} aria-label="Close attachment preview" title="Close"><X size={20} /></button></div>
      </header>
      <div className="member-announcement-viewer-stage">
        {error && <p className="member-event-file-viewer-error" role="alert">{error}</p>}
        {attachments.length > 1 && <button className="member-announcement-viewer-nav previous" type="button" disabled={loadingPath !== null} onClick={() => stepPreview(-1)} aria-label="Previous attachment"><ChevronLeft size={22} /></button>}
        {previewFailed ? <div className="member-event-file-preview-failed"><p>Preview unavailable. Try again or download the file to open it.</p><button type="button" disabled={loadingPath !== null} onClick={() => void previewAttachment(preview.attachment)}>Retry preview</button></div>
          : preview.attachment.content_type === 'application/pdf' ? <iframe key={preview.url} src={preview.url} title={`Preview of ${preview.attachment.file_name}`} onError={() => setPreviewFailed(true)} />
            : <Image key={preview.url} src={preview.url} alt={`Preview of ${preview.attachment.file_name}`} width={1200} height={900} unoptimized onError={() => setPreviewFailed(true)} style={{ transform: `scale(${zoom})` }} />}
        {attachments.length > 1 && <button className="member-announcement-viewer-nav next" type="button" disabled={loadingPath !== null} onClick={() => stepPreview(1)} aria-label="Next attachment"><ChevronRight size={22} /></button>}
      </div>
      {attachments.length > 1 && <footer className="member-announcement-viewer-filmstrip">{attachments.map((attachment, itemIndex) => <button key={attachment.object_path} type="button" className={attachment.object_path === preview.attachment.object_path ? 'selected' : ''} onClick={() => void previewAttachment(attachment)} disabled={loadingPath !== null} aria-label={`View ${attachment.file_name}`} aria-current={attachment.object_path === preview.attachment.object_path ? 'true' : undefined}>{attachment.content_type === 'application/pdf' ? <FileText size={20} /> : <PrivateThumbnail eventId={eventId} attachment={attachment} compact />}<small>{itemIndex + 1}</small></button>)}</footer>}
    </ViewerDialog>}
  </div>
}
