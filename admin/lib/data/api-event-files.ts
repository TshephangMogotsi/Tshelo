import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateEventFileUploadSessionRequest,
  EventFile,
  EventFileAccess,
  EventFileUploadSession,
  FinalizeEventFileRequest,
  RemoveEventFileResult,
} from '@shared/contracts/events'
import { dataFailure, dataSuccess, type ApiDataResult } from './api-pagination'

const BUCKET = 'event-files'
const ACCESS_SECONDS = 5 * 60
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FILE_SELECT = 'id, event_id, uploaded_by, file_name, object_path, content_type, size_bytes, created_at, updated_at'

type FileRow = Omit<EventFile, 'size_bytes'> & { size_bytes: number | string }
type UploadRow = CreateEventFileUploadSessionRequest & {
  id: string
  object_path: string
  expires_at: string
}

function toEventFile(row: FileRow): EventFile {
  return { ...row, size_bytes: Number(row.size_bytes) }
}

function invalidIds<T>(...ids: string[]): ApiDataResult<T> | null {
  return ids.every(id => UUID_PATTERN.test(id))
    ? null
    : dataFailure({ kind: 'validation', message: 'Event and file IDs must be valid UUIDs.' })
}

function fileFailure<T>(error: { code?: string; message?: string }): ApiDataResult<T> {
  const message = error.message ?? ''
  if (message.includes('EVENT_FILE_LIMIT_REACHED')) {
    return dataFailure({ kind: 'business', code: 'CONFLICT', message: 'This event has reached its 10-file limit, including pending uploads.' })
  }
  if (message.includes('EVENT_FILE_INACTIVE')) {
    return dataFailure({ kind: 'business', code: 'CONFLICT', message: 'Completed or cancelled events cannot accept file changes.' })
  }
  if (message.includes('EVENT_FILE_FORBIDDEN')) {
    return dataFailure({ kind: 'business', code: 'FORBIDDEN', message: 'You do not have permission to manage files for this event.' })
  }
  if (message.includes('EVENT_FILE_NOT_FOUND')) {
    return dataFailure({ kind: 'business', code: 'NOT_FOUND', message: 'The requested event file or upload could not be found.' })
  }
  if (message.includes('EVENT_FILE_UPLOAD_EXPIRED')) {
    return dataFailure({ kind: 'business', code: 'CONFLICT', message: 'This upload session has expired or was removed. Start a new upload.' })
  }
  if (message.includes('EVENT_FILE_UPLOAD_MISSING')) {
    return dataFailure({ kind: 'validation', message: 'The file has not finished uploading. Start a new upload and wait for it to finish before saving.' })
  }
  if (message.includes('EVENT_FILE_UPLOAD_MISMATCH') || message.includes('EVENT_FILE_INVALID')) {
    return dataFailure({ kind: 'validation', message: 'The file type or size does not match the upload session. Use a PDF, JPG, PNG, or WEBP file no larger than 10 MB.' })
  }
  return dataFailure({ kind: 'database', error })
}

function unexpectedFailure<T>(): ApiDataResult<T> {
  return dataFailure({ kind: 'database', error: { message: 'Event file operation failed.' } })
}

export async function listApiEventFiles(client: SupabaseClient, eventId: string): Promise<ApiDataResult<EventFile[]>> {
  const invalid = invalidIds<EventFile[]>(eventId)
  if (invalid) return invalid
  const result = await client.from('event_files').select(FILE_SELECT).eq('event_id', eventId)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
  if (result.error) return fileFailure(result.error)
  return dataSuccess(((result.data ?? []) as FileRow[]).map(toEventFile))
}

type CleanupOutcome = 'complete' | 'pending' | 'uncertain'

async function discardPendingUpload(client: SupabaseClient, eventId: string, uploadId: string): Promise<CleanupOutcome> {
  let claimed = false
  try {
    const claim = await client.rpc('prepare_event_file_removal', {
      p_event_id: eventId, p_file_id: uploadId, p_pending_only: true,
    })
    if (claim.error) return 'uncertain'
    // NULL means no owned pending upload (including a concurrent finalise).
    if (!claim.data) return 'complete'
    claimed = true
    const removed = await client.storage.from(BUCKET).remove([claim.data as string])
    return removed.error ? 'pending' : 'complete'
  } catch {
    return claimed ? 'pending' : 'uncertain'
  }
}

async function cleanupFailure<T>(client: SupabaseClient, eventId: string, uploadId: string, failure: ApiDataResult<T>): Promise<ApiDataResult<T>> {
  const cleanup = await discardPendingUpload(client, eventId, uploadId)
  if (cleanup === 'complete') return failure
  if (cleanup === 'uncertain') {
    // The finalise may have committed before its response was lost. Never
    // suggest a normal DELETE until pending-only cleanup confirms a claim.
    return dataFailure({
      kind: 'business', code: 'INTERNAL_ERROR', retryable: true,
      message: 'The upload status could not be confirmed. Retry to check its status.',
    })
  }
  return dataFailure({
    kind: 'business', code: 'CONFLICT',
    message: 'The upload could not be saved and its cleanup is pending. Remove this upload before starting a new one.',
    details: { event_id: eventId, upload_id: uploadId, cleanup_pending: true },
  })
}

export async function createApiEventFileUploadSession(
  client: SupabaseClient,
  eventId: string,
  input: CreateEventFileUploadSessionRequest,
): Promise<ApiDataResult<EventFileUploadSession>> {
  const invalid = invalidIds<EventFileUploadSession>(eventId)
  if (invalid) return invalid
  let uploadId: string | undefined
  try {
    const reservation = await client.rpc('create_event_file_upload', {
      p_event_id: eventId, p_file_name: input.file_name,
      p_content_type: input.content_type, p_size_bytes: input.size_bytes,
    }).single()
    if (reservation.error) return fileFailure(reservation.error)
    const upload = reservation.data as UploadRow
    uploadId = upload.id
    const signed = await client.storage.from(BUCKET).createSignedUploadUrl(upload.object_path, { upsert: false })
    if (signed.error) return cleanupFailure(client, eventId, upload.id, fileFailure(signed.error))
    return dataSuccess({
      upload_id: upload.id,
      object_path: upload.object_path,
      file_name: upload.file_name,
      content_type: upload.content_type,
      size_bytes: Number(upload.size_bytes),
      upload_url: signed.data.signedUrl,
      expires_at: upload.expires_at,
    })
  } catch {
    return uploadId
      ? cleanupFailure(client, eventId, uploadId, unexpectedFailure())
      : unexpectedFailure()
  }
}

export async function finalizeApiEventFile(
  client: SupabaseClient,
  eventId: string,
  input: FinalizeEventFileRequest,
): Promise<ApiDataResult<EventFile>> {
  const invalid = invalidIds<EventFile>(eventId, input.upload_id)
  if (invalid) return invalid
  try {
    const result = await client.rpc('finalize_event_file_upload', {
      p_event_id: eventId, p_upload_id: input.upload_id,
    }).single()
    if (result.error) return cleanupFailure(client, eventId, input.upload_id, fileFailure(result.error))
    return dataSuccess(toEventFile(result.data as FileRow))
  } catch {
    return cleanupFailure(client, eventId, input.upload_id, unexpectedFailure())
  }
}

export async function createApiEventFileAccess(
  client: SupabaseClient, eventId: string, fileId: string,
): Promise<ApiDataResult<EventFileAccess>> {
  const invalid = invalidIds<EventFileAccess>(eventId, fileId)
  if (invalid) return invalid
  try {
    // RLS checks current participation. Neither an arbitrary path nor a pending
    // upload can be used to obtain a participant preview/download URL.
    const result = await client.from('event_files').select('id, object_path')
      .eq('event_id', eventId).eq('id', fileId).maybeSingle()
    if (result.error) return fileFailure(result.error)
    if (!result.data) return fileFailure({ message: 'EVENT_FILE_NOT_FOUND' })
    const expiresAt = new Date(Date.now() + ACCESS_SECONDS * 1000).toISOString()
    const signed = await client.storage.from(BUCKET).createSignedUrl(result.data.object_path, ACCESS_SECONDS)
    if (signed.error) return fileFailure(signed.error)
    return dataSuccess({ file_id: fileId, download_url: signed.data.signedUrl, expires_at: expiresAt })
  } catch {
    return unexpectedFailure()
  }
}

export async function removeApiEventFile(
  client: SupabaseClient, eventId: string, fileId: string,
): Promise<ApiDataResult<RemoveEventFileResult>> {
  const invalid = invalidIds<RemoveEventFileResult>(eventId, fileId)
  if (invalid) return invalid
  try {
    // The transaction checks manager permission and hides the file before
    // removing bytes. Its durable claim allows retry after a Storage outage.
    const claim = await client.rpc('prepare_event_file_removal', {
      p_event_id: eventId, p_file_id: fileId, p_pending_only: false,
    })
    if (claim.error) return fileFailure(claim.error)
    if (!claim.data) return fileFailure({ message: 'EVENT_FILE_NOT_FOUND' })
    const removed = await client.storage.from(BUCKET).remove([claim.data as string])
    if (removed.error) return fileFailure(removed.error)
    return dataSuccess({ file_id: fileId })
  } catch {
    return unexpectedFailure()
  }
}
