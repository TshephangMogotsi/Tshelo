'use client'

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import Image from 'next/image'
import { Crosshair, ImagePlus, LoaderCircle, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { EVENT_MAX_FILES, type EventFile } from '@shared/contracts'
import { eventFileError, EventFileInputError, validateEventFile } from '@shared/event-files'
import { EventAttachments } from './event-attachments'
import { eventAttachmentThumbnailUrl } from './event-attachment-access'
import type { useEventFiles } from './use-event-files'

type FocalPoint = { x: number; y: number }

function coordinate(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0.5
}

function fileFocalPoint(file: EventFile | undefined): FocalPoint {
  return { x: coordinate(file?.banner_focal_x), y: coordinate(file?.banner_focal_y) }
}

function BannerFocalPicker({ eventId, file, value, disabled, onChange }: {
  eventId: string
  file: EventFile
  value: FocalPoint
  disabled: boolean
  onChange: (next: FocalPoint) => void
}) {
  const horizontalId = useId()
  const verticalId = useId()
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const [ratio, setRatio] = useState(4 / 3)
  const dragging = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    void eventAttachmentThumbnailUrl(eventId, file, 'banner', controller.signal)
      .then(next => { if (!controller.signal.aborted) setUrl(next) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [eventId, file])

  function choose(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    onChange({
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    })
  }

  return <section className="member-event-focal-picker" aria-labelledby={`${horizontalId}-title`}>
    <div className="member-event-focal-copy">
      <strong id={`${horizontalId}-title`}>Choose the important part</strong>
      <p>Click or drag the marker onto a face or detail that should stay visible as the banner changes shape.</p>
    </div>
    <div className="member-event-focal-stage-wrap">
      <div
        className="member-event-focal-stage"
        style={{ aspectRatio: `${ratio}`, maxWidth: `min(100%, ${Math.min(900, Math.round(360 * ratio))}px)` }}
        onPointerDown={event => {
          if (disabled) return
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          choose(event)
        }}
        onPointerMove={event => { if (dragging.current) choose(event) }}
        onPointerUp={event => {
          dragging.current = false
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => { dragging.current = false }}
      >
        {!url && !failed && <span className="member-event-focal-loading" role="status"><LoaderCircle size={22} aria-hidden="true" /> Loading preview…</span>}
        {failed && <span className="member-event-focal-loading" role="alert">The private preview could not be loaded. Choose the image again or retry later.</span>}
        {url && <Image
          src={url}
          alt={`Set the focal point for ${file.file_name}`}
          fill
          sizes="(max-width: 680px) calc(100vw - 76px), 900px"
          unoptimized
          draggable={false}
          onLoad={event => {
            const image = event.currentTarget
            if (image.naturalWidth > 0 && image.naturalHeight > 0) setRatio(image.naturalWidth / image.naturalHeight)
          }}
          onError={() => setFailed(true)}
        />}
        {url && <span className="member-event-focal-marker" style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }} aria-hidden="true"><Crosshair size={25} /></span>}
      </div>
    </div>
    <div className="member-event-focal-controls">
      <label htmlFor={horizontalId}><span>Horizontal position</span><input id={horizontalId} aria-label="Horizontal focal point" type="range" min="0" max="100" step="1" value={Math.round(value.x * 100)} disabled={disabled} onChange={event => onChange({ ...value, x: Number(event.target.value) / 100 })} /></label>
      <label htmlFor={verticalId}><span>Vertical position</span><input id={verticalId} aria-label="Vertical focal point" type="range" min="0" max="100" step="1" value={Math.round(value.y * 100)} disabled={disabled} onChange={event => onChange({ ...value, y: Number(event.target.value) / 100 })} /></label>
      <button type="button" disabled={disabled || (value.x === 0.5 && value.y === 0.5)} onClick={() => onChange({ x: 0.5, y: 0.5 })}><RotateCcw size={15} />Reset to centre</button>
    </div>
  </section>
}

export function EventBanner({ eventId, eventName, eventEmoji, manager, canManage, inactive }: {
  eventId: string; eventName: string; eventEmoji: string | null; manager: ReturnType<typeof useEventFiles>; canManage: boolean; inactive: boolean
}) {
  const selectId = useId()
  const picker = useRef<HTMLInputElement>(null)
  const locked = useRef(false)
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState('')
  const [focalPoint, setFocalPoint] = useState<FocalPoint>({ x: 0.5, y: 0.5 })
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const images = manager.files.filter(file => file.content_type !== 'application/pdf' && !manager.removals.some(item => item.file.id === file.id))
  const banner = images.find(file => file.is_banner)
  const selectedImage = images.find(file => file.id === selected)
  const busy = working || manager.busy
  const atLimit = manager.files.length + manager.uploads.length >= EVENT_MAX_FILES

  async function change(fileId: string | null, point?: FocalPoint) {
    if (!canManage || locked.current || manager.busy) return
    locked.current = true; setWorking(true); setMessage(''); setError('')
    try {
      if (await manager.updateBanner(fileId, fileId && point ? { focal_x: point.x, focal_y: point.y } : undefined)) {
        setEditing(false); setMessage(fileId ? 'Event banner updated.' : 'Banner removed. The image is still in Files.')
      } else setError('The banner change could not be confirmed. The image remains in Files, so you can retry without uploading it again.')
    } finally { locked.current = false; setWorking(false) }
  }

  async function upload(file: File | undefined) {
    if (!file || !canManage || locked.current || manager.busy) return
    locked.current = true; setWorking(true); setMessage(''); setError('')
    try {
      const input = validateEventFile({ name: file.name, size: file.size, mimeType: file.type, uri: '' })
      if (input.content_type === 'application/pdf') throw new EventFileInputError('Choose a JPG, PNG, or WEBP image for the banner.')
      const saved = (await manager.addFiles([file]))?.[0]
      if (!saved) {
        setError('The image could not be saved. Open Files to retry the upload or finish cleanup, then choose the saved image here.')
        return
      }
      setSelected(saved.id)
      setFocalPoint({ x: 0.5, y: 0.5 })
      setMessage('Image uploaded. Choose its important point, then save the banner.')
    } catch (cause) { setError(eventFileError(cause)) }
    finally { locked.current = false; setWorking(false) }
  }

  return <section className="member-card member-event-banner" aria-label={`Banner for ${eventName}`} aria-busy={busy}>
    {banner ? <EventAttachments eventId={eventId} attachments={[banner]} layout="banner" busy={busy} />
      : <div className="member-event-banner-empty"><span aria-hidden="true">{eventEmoji ?? '🎉'}</span><div><strong>{canManage ? 'Give your event a cover' : eventName}</strong><p>{canManage ? `Add a photo to welcome everyone to ${eventName}.` : 'A private event shared with its participants.'}</p></div></div>}
    {(banner || canManage) && <div className="member-event-banner-controls">
      <div><strong>Event banner</strong><p>{inactive ? 'This event is read-only. A compressed preview saves data.' : 'A compressed preview saves data; the eye icon opens the private original.'}</p></div>
      {canManage && <div className="member-event-banner-actions">
        <button type="button" disabled={busy} aria-expanded={editing} onClick={() => { setEditing(value => !value); setSelected(banner?.id ?? ''); setFocalPoint(fileFocalPoint(banner)); setError(''); setMessage('') }}><Pencil size={15} />{banner ? 'Change banner' : 'Add banner'}</button>
        {banner && <button type="button" disabled={busy} onClick={() => {
          if (window.confirm('Remove this event banner? The image will remain in Files.')) void change(null)
        }}><Trash2 size={15} />Remove banner</button>}
      </div>}
    </div>}
    {editing && canManage && <div className="member-event-banner-editor">
      <label htmlFor={selectId}>Choose an image from Files</label>
      <div className="member-event-banner-actions"><select id={selectId} value={selected} disabled={busy} onChange={event => {
        const next = event.target.value
        setSelected(next)
        setFocalPoint(fileFocalPoint(images.find(file => file.id === next)))
      }}>
        <option value="">{images.length ? 'Select an image…' : 'No images in Files yet'}</option>
        {images.map(file => <option key={file.id} value={file.id}>{file.file_name}{file.is_banner ? ' (current banner)' : ''}</option>)}
      </select></div>
      {selectedImage && <BannerFocalPicker key={selectedImage.id} eventId={eventId} file={selectedImage} value={focalPoint} disabled={busy} onChange={setFocalPoint} />}
      <div className="member-event-banner-actions"><input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Upload event banner" disabled={busy || atLimit} onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void upload(file)
      }} /><button type="button" disabled={busy || atLimit} onClick={() => picker.current?.click()}><ImagePlus size={16} />Upload new image</button><button type="button" disabled={busy || !images.some(file => file.id === selected)} onClick={() => void change(selected, focalPoint)}>{selected === banner?.id ? 'Save banner' : 'Use as banner'}</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
      <p>JPG, PNG, or WEBP · up to 10 MB. Uploads are also saved in Files ({manager.files.length} of {EVENT_MAX_FILES}). {atLimit ? 'The file limit is reached; choose an existing image or free a slot in Files.' : 'Changing or removing the banner keeps previous images in Files.'}</p>
    </div>}
    {busy && <p className="member-event-banner-feedback" role="status">{manager.uploads.some(task => task.status === 'working') ? 'Uploading banner image… See Files for progress.' : 'Saving changes…'}</p>}
    {message && <p className="member-event-banner-feedback" role="status">{message}</p>}
    {(error || (editing && manager.error)) && <p className="member-form-error member-event-banner-feedback" role="alert">{error || manager.error}</p>}
  </section>
}
