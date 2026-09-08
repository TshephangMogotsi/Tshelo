import { TsheloApiError } from '@shared/api-client'
import { EVENT_FILE_MAX_BYTES, type EventFile, type EventFileUploadSession, type JsonObject } from '@shared/contracts'
import { runEventFileUpload, validateEventFile, validateEventFileCount, type EventFileOperations, type FileUpload } from '../eventFiles'

const asset = { name: 'plan.pdf', mimeType: 'application/pdf', size: 100, uri: 'file:///plan.pdf' }
const input = validateEventFile(asset)
const session: EventFileUploadSession = { ...input, upload_id: 'upload-1', object_path: 'event-1/user-1/file', upload_url: 'https://storage.test/signed-upload', expires_at: '2026-09-09T12:00:00Z' }
const file: EventFile = { ...input, id: session.upload_id, event_id: 'event-1', uploaded_by: 'user-1', object_path: session.object_path, created_at: '2026-09-09T10:00:00Z', updated_at: '2026-09-09T10:00:00Z' }
const initial = (): FileUpload => ({ key: 'local-1', asset, input, step: 'upload', status: 'queued' })
const apiError = (code: 'CONFLICT' | 'VALIDATION_FAILED' | 'FORBIDDEN' | 'UNAUTHENTICATED' | 'INTERNAL_ERROR', details?: JsonObject) => new TsheloApiError(code === 'INTERNAL_ERROR' ? 500 : 409, null, { code, message: 'Rejected', retryable: code === 'INTERNAL_ERROR', ...(details ? { details } : {}) })

describe('event file validation', () => {
  it.each(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])('accepts %s within the size limit', mimeType => {
    expect(validateEventFile({ ...asset, mimeType, size: EVENT_FILE_MAX_BYTES }).content_type).toBe(mimeType)
  })
  it('infers only missing or generic MIME from a supported extension', () => {
    expect(validateEventFile({ ...asset, name: 'MAP.PNG', mimeType: undefined }).content_type).toBe('image/png')
    expect(validateEventFile({ ...asset, mimeType: 'application/octet-stream' }).content_type).toBe('application/pdf')
    expect(() => validateEventFile({ ...asset, mimeType: 'text/html' })).toThrow('must be a PDF')
  })
  it.each([0, -1, 1.5, NaN, undefined, EVENT_FILE_MAX_BYTES + 1])('rejects invalid size %s', size => {
    expect(() => validateEventFile({ ...asset, size })).toThrow('non-empty file')
  })
  it.each(['', '../plan.pdf', 'bad\\name.pdf', 'bad\u0000name.pdf', 'a'.repeat(256)])('rejects invalid filename %s', name => {
    expect(() => validateEventFile({ ...asset, name })).toThrow('filename')
  })
  it('counts queued/failed uploads against remaining capacity', () => {
    expect(() => validateEventFileCount(8, 2)).not.toThrow()
    expect(() => validateEventFileCount(9, 2)).toThrow('up to 10')
  })
})

describe('event upload recovery', () => {
  let operations: jest.Mocked<EventFileOperations>
  let latest: FileUpload
  const changed = (task: FileUpload) => { latest = task }
  beforeEach(() => {
    latest = initial()
    operations = {
      createSession: jest.fn().mockResolvedValue(session),
      transfer: jest.fn().mockImplementation(async (_asset, _session, progress) => { progress(50) }),
      finalize: jest.fn().mockResolvedValue(file),
      remove: jest.fn().mockResolvedValue({ file_id: session.upload_id }),
    }
  })
  const run = (allowed = true) => runEventFileUpload(latest, 'event-1', operations, () => allowed, changed)

  it('reserves, uploads, then finalises with progress', async () => {
    await expect(run()).resolves.toEqual(file)
    expect(operations.createSession).toHaveBeenCalledWith(input)
    expect(operations.transfer).toHaveBeenCalledWith(asset, session, expect.any(Function))
    expect(operations.finalize).toHaveBeenCalledWith('upload-1')
    expect(latest).toMatchObject({ progress: 100, step: 'finalize' })
    expect(operations.remove).not.toHaveBeenCalled()
  })
  it('blocks new uploads for a completed event or permission loss', async () => {
    await run(false)
    expect(latest).toMatchObject({ status: 'failed', step: 'upload', error: expect.stringContaining('read-only') })
    expect(operations.createSession).not.toHaveBeenCalled()
  })
  it('cleans a failed binary transfer and retries with a new session', async () => {
    operations.transfer.mockRejectedValueOnce(new TypeError('offline'))
    await run()
    expect(operations.remove).toHaveBeenCalledWith('upload-1')
    expect(operations.finalize).not.toHaveBeenCalled()
    expect(latest).toMatchObject({ step: 'upload', status: 'failed', uploadId: undefined })
    await expect(run()).resolves.toEqual(file)
    expect(operations.createSession).toHaveBeenCalledTimes(2)
  })
  it('retains failed cleanup and allows retry after event completion', async () => {
    operations.transfer.mockRejectedValueOnce(new TypeError('offline'))
    operations.remove.mockRejectedValueOnce(new TypeError('offline'))
    await run()
    expect(latest).toMatchObject({ step: 'cleanup', status: 'failed', uploadId: 'upload-1' })
    await run(false)
    expect(latest).toMatchObject({ step: 'upload', uploadId: undefined })
    expect(operations.createSession).toHaveBeenCalledTimes(1)
  })
  it('retries an uncertain finalisation using the same ID, even if now read-only', async () => {
    operations.finalize.mockRejectedValueOnce(new TypeError('response lost'))
    await run()
    expect(latest).toMatchObject({ step: 'finalize', status: 'failed', uploadId: 'upload-1' })
    expect(operations.remove).not.toHaveBeenCalled()
    await expect(run(false)).resolves.toEqual(file)
    expect(operations.createSession).toHaveBeenCalledTimes(1)
    expect(operations.transfer).toHaveBeenCalledTimes(1)
    expect(operations.finalize).toHaveBeenNthCalledWith(2, 'upload-1')
  })
  it('checks an uncertain server cleanup without deleting or re-uploading a possible success', async () => {
    operations.finalize.mockRejectedValueOnce(apiError('INTERNAL_ERROR'))
    await run()
    expect(latest).toMatchObject({ step: 'finalize', status: 'failed', uploadId: 'upload-1' })
    await expect(run(false)).resolves.toEqual(file)
    expect(operations.remove).not.toHaveBeenCalled()
    expect(operations.createSession).toHaveBeenCalledTimes(1)
    expect(operations.transfer).toHaveBeenCalledTimes(1)
    expect(operations.finalize).toHaveBeenNthCalledWith(2, 'upload-1')
  })
  it.each(['CONFLICT', 'VALIDATION_FAILED'] as const)('resets a definitive %s rejection after server cleanup', async code => {
    operations.finalize.mockRejectedValueOnce(apiError(code))
    await run()
    expect(latest).toMatchObject({ step: 'upload', uploadId: undefined, status: 'failed' })
    expect(operations.remove).not.toHaveBeenCalled()
    await run()
    expect(operations.createSession).toHaveBeenCalledTimes(2)
  })
  it.each(['FORBIDDEN', 'UNAUTHENTICATED'] as const)('never deletes an unconfirmed success on %s', async code => {
    operations.finalize.mockRejectedValueOnce(apiError(code))
    await run()
    expect(latest).toMatchObject({ step: 'finalize', uploadId: 'upload-1' })
    expect(operations.remove).not.toHaveBeenCalled()
  })
  it.each(['createSession', 'finalize'] as const)('recovers cleanup_pending from %s', async method => {
    operations[method].mockRejectedValueOnce(apiError('CONFLICT', { event_id: 'event-1', upload_id: 'cleanup-id', cleanup_pending: true }))
    await run()
    expect(latest).toMatchObject({ step: 'cleanup', uploadId: 'cleanup-id', status: 'failed' })
    await run(false)
    expect(operations.remove).toHaveBeenCalledWith('cleanup-id')
  })
  it('does not accept a cleanup claim from another event', async () => {
    operations.createSession.mockRejectedValueOnce(apiError('CONFLICT', { event_id: 'other-event', upload_id: 'other-upload', cleanup_pending: true }))
    await run()
    expect(latest.uploadId).toBeUndefined()
    expect(operations.remove).not.toHaveBeenCalled()
  })
})
