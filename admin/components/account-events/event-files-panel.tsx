'use client'

import { useRef } from 'react'
import { FolderOpen, LoaderCircle, LockKeyhole, Plus } from 'lucide-react'
import { EVENT_FILE_MEDIA_TYPES, EVENT_MAX_FILES } from '@shared/contracts'
import { EventAttachments } from './event-attachments'
import type { useEventFiles } from './use-event-files'

export function EventFilesPanel({ eventId, manager, canManage, inactive }: {
  eventId: string; manager: ReturnType<typeof useEventFiles>; canManage: boolean; inactive: boolean
}) {
  const picker = useRef<HTMLInputElement>(null)
  const { files, uploads, removals, busy, error } = manager
  const visible = files.filter(file => !removals.some(item => item.file.id === file.id))
  const images = visible.filter(file => file.content_type !== 'application/pdf')
  const documents = visible.filter(file => file.content_type === 'application/pdf')
  const atLimit = files.length + uploads.length >= EVENT_MAX_FILES
  const remove = canManage ? (file: typeof files[number]) => { void manager.confirmRemove(file) } : undefined

  return <section className="member-card member-event-files" id="event-files">
    <header>
      <div className="member-section-title"><span><FolderOpen size={18} /></span><h2>Event files</h2></div>
      {canManage && <div className="member-announcement-file-picker">
        <input ref={picker} type="file" accept={EVENT_FILE_MEDIA_TYPES.join(',')} multiple disabled={busy || atLimit} aria-label="Choose event files" tabIndex={-1} onChange={event => {
          const selected = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          void manager.addFiles(selected)
        }} />
        <button type="button" onClick={() => picker.current?.click()} disabled={busy || atLimit}>{busy ? <LoaderCircle size={16} /> : <Plus size={16} />} Add files</button>
      </div>}
    </header>
    <div className="member-card-body">
      <div className="member-event-files-intro"><strong>{visible.length} of {EVENT_MAX_FILES} files · 10 MB each</strong><p>Images and PDFs shared with everyone in this event.</p></div>
      {!canManage ? <p className="member-event-files-notice"><LockKeyhole size={16} aria-hidden="true" /><span>{inactive ? 'This event is read-only. You can still preview and download its files.' : 'Only organisers with file-management access can add or delete files. You can preview and download them.'}</span></p>
        : <p className="member-event-files-hint">{atLimit ? 'File limit reached. Remove a file or dismiss a failed upload to make room.' : 'PDF, JPG, PNG, or WEBP. Choose one or more files.'}</p>}
      {error && <p className="member-form-error" role="alert">{error}</p>}
      {uploads.length > 0 && <ul className="member-event-file-operations" aria-label="File uploads">{uploads.map(task => <li key={task.key}>
        <strong>{task.input.file_name}</strong>
        {task.status === 'failed' ? <>
          <p className="member-form-error" role="alert">{task.error}</p>
          {task.step === 'finalize' && <p>The save result is unconfirmed. Check again to avoid uploading a duplicate.</p>}
          <div className="member-event-file-recovery">
            {(canManage || task.step !== 'upload') && <button type="button" disabled={busy} onClick={() => void manager.retryUpload(task)}>{task.step === 'cleanup' ? 'Retry cleanup' : task.step === 'finalize' ? 'Check upload' : 'Retry upload'}</button>}
            {!task.uploadId && <button type="button" disabled={busy} onClick={() => manager.dismissUpload(task)} aria-label={`Dismiss failed upload ${task.input.file_name}`}>Dismiss</button>}
          </div>
        </> : <div role="status"><p>{task.status === 'queued' ? 'Waiting…' : task.step === 'finalize' ? 'Saving file…' : task.step === 'cleanup' ? 'Cleaning up unfinished upload…' : task.progress == null ? 'Preparing upload…' : `Uploading… ${task.progress}%`}</p><progress max={100} value={task.progress} aria-label={`Upload progress for ${task.input.file_name}`} /></div>}
      </li>)}</ul>}
      {removals.length > 0 && <ul className="member-event-file-operations" aria-label="File deletions">{removals.map(item => <li key={item.file.id}>
        <strong>{item.file.file_name}</strong>
        {item.error ? <><p className="member-form-error" role="alert">Could not finish deleting. {item.error}</p><div className="member-event-file-recovery"><button type="button" disabled={busy} onClick={() => void manager.retryRemove(item.file)} aria-label={`Retry deleting ${item.file.file_name}`}>Retry deletion</button></div></> : <p role="status">Deleting file…</p>}
      </li>)}</ul>}
      {visible.length === 0 && uploads.length === 0 && removals.length === 0 && <div className="member-event-files-empty"><FolderOpen size={36} aria-hidden="true" /><h3>No event files yet</h3><p>{canManage ? 'Add a programme, venue map, or photos for everyone to find in one place.' : inactive ? 'No files were added to this event.' : 'When an organiser adds images or documents, they’ll appear here.'}</p></div>}
      {images.length > 0 && <section aria-label="Event images"><h3>Images · {images.length}</h3><EventAttachments eventId={eventId} attachments={images} layout="gallery" onRemove={remove} busy={busy} /></section>}
      {documents.length > 0 && <section className="member-event-file-documents" aria-label="Event documents"><h3>Documents · {documents.length}</h3><EventAttachments eventId={eventId} attachments={documents} onRemove={remove} busy={busy} /></section>}
    </div>
  </section>
}
