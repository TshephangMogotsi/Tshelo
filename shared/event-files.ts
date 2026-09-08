import { TsheloApiError, TsheloApiProtocolError } from './api-client'
import {
  EVENT_FILE_MAX_BYTES, EVENT_FILE_MEDIA_TYPES, EVENT_MAX_FILES,
  type CreateEventFileUploadSessionRequest, type EventFile, type EventFileMediaType,
  type EventFileUploadSession,
} from './contracts'

export type PickedEventFile = { name: string; uri: string; mimeType?: string; size?: number; file?: File }
export type FileUpload = {
  key: string
  asset: PickedEventFile
  input: CreateEventFileUploadSessionRequest
  uploadId?: string
  step: 'upload' | 'finalize' | 'cleanup'
  status: 'queued' | 'working' | 'failed'
  progress?: number
  error?: string
}
export type FileRemoval = { file: EventFile; error?: string }

export class EventFileInputError extends Error {}

export function eventFileError(error: unknown) {
  if (error instanceof EventFileInputError || error instanceof TsheloApiError) return error.message
  if (error instanceof TsheloApiProtocolError) return 'The server returned an unexpected response. Please try again later.'
  if (error instanceof TypeError || (error instanceof Error && error.message === 'Tshelo API request timed out.')) return 'Check your connection and try again.'
  if (error instanceof Error && error.name === 'AbortError') return 'Request cancelled.'
  return 'Something went wrong. Please try again.'
}

export function formatEventFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function validateEventFile(asset: PickedEventFile): CreateEventFileUploadSessionRequest {
  const name = asset.name.trim()
  const extensions: Record<string, EventFileMediaType> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
  const mime = asset.mimeType?.toLowerCase()
  // Only infer a missing/generic MIME type; never override a known unsupported type.
  const contentType = !mime || mime === 'application/octet-stream' ? extensions[name.split('.').pop()?.toLowerCase() ?? ''] : mime
  if (!contentType || !EVENT_FILE_MEDIA_TYPES.includes(contentType as EventFileMediaType)) {
    throw new EventFileInputError(`${name || 'This file'} must be a PDF, JPG, PNG, or WEBP image.`)
  }
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f/\\]/.test(name)) {
    throw new EventFileInputError('Use a filename of 1–255 characters without slashes or control characters.')
  }
  if (!Number.isSafeInteger(asset.size) || !asset.size || asset.size < 1 || asset.size > EVENT_FILE_MAX_BYTES) {
    throw new EventFileInputError(`${name} must be a non-empty file no larger than 10 MB.`)
  }
  return { file_name: name, content_type: contentType as EventFileMediaType, size_bytes: asset.size }
}

export function validateEventFileCount(existing: number, selected: number) {
  if (existing + selected > EVENT_MAX_FILES) {
    throw new EventFileInputError(`An event can have up to ${EVENT_MAX_FILES} files. Choose fewer files or remove an existing file first.`)
  }
}

export type EventFileOperations = {
  createSession: (input: CreateEventFileUploadSessionRequest) => Promise<EventFileUploadSession>
  transfer: (asset: PickedEventFile, session: EventFileUploadSession, progress: (percent: number) => void) => Promise<void>
  finalize: (uploadId: string) => Promise<EventFile>
  remove: (uploadId: string) => Promise<unknown>
}

function cleanupId(error: unknown, eventId: string) {
  const details = error instanceof TsheloApiError ? error.apiError.details : undefined
  if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined
  return details.cleanup_pending === true && details.event_id === eventId && typeof details.upload_id === 'string'
    ? details.upload_id : undefined
}

/** A retry resumes finalisation, never uploads duplicate bytes or deletes an uncertain success. */
export async function runEventFileUpload(
  original: FileUpload,
  eventId: string,
  operations: EventFileOperations,
  canUpload: () => boolean,
  changed: (upload: FileUpload) => void,
): Promise<EventFile | null> {
  let task: FileUpload = { ...original, status: 'working', error: undefined }
  const update = (patch: Partial<FileUpload>) => { task = { ...task, ...patch }; changed(task) }
  update({})
  try {
    if (task.step === 'cleanup' && task.uploadId) {
      await operations.remove(task.uploadId)
      update({ uploadId: undefined, step: 'upload', status: 'failed', progress: undefined, error: 'Unfinished upload removed. You can retry when the event accepts files.' })
      return null
    }
    if (task.step === 'upload') {
      if (!canUpload()) throw new EventFileInputError('This event is read-only. You can still view and download its files.')
      const session = await operations.createSession(task.input)
      update({ uploadId: session.upload_id, progress: 0 })
      try {
        await operations.transfer(task.asset, session, progress => update({ progress }))
      } catch (error) {
        // No finalise request has been sent, so this is safe to cancel.
        update({ step: 'cleanup' })
        await operations.remove(session.upload_id)
        update({ uploadId: undefined, step: 'upload', progress: undefined })
        throw error
      }
      update({ step: 'finalize', progress: 100 })
    }
    if (!task.uploadId) throw new EventFileInputError('Start a new upload for this file.')
    return await operations.finalize(task.uploadId)
  } catch (error) {
    const pendingId = cleanupId(error, eventId)
    if (pendingId) {
      update({ uploadId: pendingId, step: 'cleanup' })
    } else if (task.step === 'finalize' && error instanceof TsheloApiError &&
      ['BAD_REQUEST', 'VALIDATION_FAILED', 'CONFLICT'].includes(error.code)) {
      // These are definitive rejected finalisations; the API has cleaned up.
      update({ uploadId: undefined, step: 'upload', progress: undefined })
    }
    update({ status: 'failed', error: eventFileError(error) })
    return null
  }
}
