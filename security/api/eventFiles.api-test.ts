jest.mock('server-only', () => ({}), { virtual: true })

import {
  createApiEventFileAccess, createApiEventFileUploadSession,
  EVENT_FILE_BANNER_TRANSFORM, EVENT_FILE_THUMBNAIL_TRANSFORM,
  finalizeApiEventFile, listApiEventFiles, removeApiEventFile,
  updateApiEventBanner,
} from '../../admin/lib/data/api-event-files'
import {
  validateCreateEventFileUploadSessionRequest, validateFinalizeEventFileRequest,
  validateUpdateEventBannerRequest,
} from '../../admin/lib/api/validation'

type SupabaseClient = Parameters<typeof finalizeApiEventFile>[0]

const eventId = '11111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'
const actorId = '33333333-3333-4333-8333-333333333333'
const objectPath = `${eventId}/${actorId}/${fileId}.pdf`
const metadata = { file_name: 'Programme.pdf', content_type: 'application/pdf' as const, size_bytes: 100 }
const file = { ...metadata, id: fileId, event_id: eventId, uploaded_by: actorId, object_path: objectPath, created_at: '2026-09-08T10:00:00Z', updated_at: '2026-09-08T10:00:00Z' }
const imagePath = `${eventId}/${actorId}/${fileId}.jpg`
const image = { ...file, file_name: 'Venue.jpg', content_type: 'image/jpeg' as const, object_path: imagePath }
type Reply = { data: unknown; error: { message: string; code?: string } | null }
const ok = (data: unknown): Reply => ({ data, error: null })
const fail = (message: string): Reply => ({ data: null, error: { message } })

function mockClient(replies: Record<string, Reply> = {}, queryReply: Reply = ok(null)) {
  const storage = {
    createSignedUploadUrl: jest.fn().mockResolvedValue(ok({ signedUrl: 'https://storage.example/upload' })),
    createSignedUrl: jest.fn().mockResolvedValue(ok({ signedUrl: 'https://storage.example/read' })),
    remove: jest.fn().mockResolvedValue(ok([{ name: objectPath }])),
  }
  const rpc = jest.fn((name: string) => {
    const result = Promise.resolve(replies[name] ?? ok(null))
    return Object.assign(result, { single: () => result })
  })
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(queryReply),
    then: (resolve: (value: Reply) => unknown) => Promise.resolve(queryReply).then(resolve),
  }
  const client = { rpc, from: jest.fn(() => query), storage: { from: jest.fn(() => storage) } }
  return { client: client as unknown as SupabaseClient, rpc, query, storage }
}

describe('event file request validation', () => {
  it('accepts a banner file ID with an optional normalized focal point, or null', () => {
    expect(validateUpdateEventBannerRequest({ file_id: fileId }).ok).toBe(true)
    expect(validateUpdateEventBannerRequest({ file_id: fileId, focal_x: 0, focal_y: 1 }).ok).toBe(true)
    expect(validateUpdateEventBannerRequest({ file_id: null }).ok).toBe(true)
    for (const body of [
      null, {}, { file_id: '' }, { file_id: false },
      { file_id: fileId, url: 'https://example.com' },
      { file_id: fileId, focal_x: 0.2 },
      { file_id: fileId, focal_y: 0.8 },
      { file_id: fileId, focal_x: -0.01, focal_y: 0.5 },
      { file_id: fileId, focal_x: 0.5, focal_y: 1.01 },
      { file_id: fileId, focal_x: '0.5', focal_y: 0.5 },
      { file_id: fileId, focal_x: Number.NaN, focal_y: 0.5 },
      { file_id: null, focal_x: 0.5, focal_y: 0.5 },
    ]) {
      expect(validateUpdateEventBannerRequest(body).ok).toBe(false)
    }
  })
  it('accepts supported files and normalises the display name', () => {
    expect(validateCreateEventFileUploadSessionRequest({ ...metadata, file_name: ' Programme.pdf ' }))
      .toEqual({ ok: true, value: metadata })
    expect(validateCreateEventFileUploadSessionRequest({ ...metadata, content_type: 'image/webp', size_bytes: 10485760 }).ok).toBe(true)
  })
  it.each([
    { content_type: 'image/svg+xml' }, { size_bytes: 0 }, { size_bytes: 10485761 },
    { size_bytes: 1.1 }, { size_bytes: '100' }, { file_name: '' }, { file_name: '../secret.pdf' },
    { file_name: 'bad\nname.pdf' }, { file_name: 'a'.repeat(256) }, { uploaded_by: actorId },
    { object_path: objectPath },
  ])('rejects invalid metadata or caller-controlled ownership: %o', override => {
    expect(validateCreateEventFileUploadSessionRequest({ ...metadata, ...override }).ok).toBe(false)
  })
  it('accepts only a session UUID for finalisation', () => {
    expect(validateFinalizeEventFileRequest({ upload_id: fileId }).ok).toBe(true)
    expect(validateFinalizeEventFileRequest({ upload_id: 'invalid' }).ok).toBe(false)
    expect(validateFinalizeEventFileRequest({ upload_id: fileId, object_path: objectPath }).ok).toBe(false)
  })
})

describe('event file data services', () => {
  it.each([fileId, null])('sets banner %s and focal point through the caller-scoped atomic RPC, without touching bytes', async id => {
    const focal = id ? { focal_x: 0.25, focal_y: 0.7 } : {}
    const response = { file_id: id, focal_x: id ? 0.25 : 0.5, focal_y: id ? 0.7 : 0.5 }
    const { client, rpc, storage } = mockClient({ set_event_banner_focal_point: ok(response) })
    expect(await updateApiEventBanner(client, eventId, { file_id: id, ...focal })).toEqual(ok(response))
    expect(rpc).toHaveBeenCalledWith('set_event_banner_focal_point', {
      p_event_id: eventId, p_file_id: id,
      p_focal_x: id ? 0.25 : 0.5, p_focal_y: id ? 0.7 : 0.5,
    })
    expect(storage.remove).not.toHaveBeenCalled()
    expect(storage.createSignedUrl).not.toHaveBeenCalled()
  })
  it.each(['EVENT_BANNER_INVALID', 'EVENT_BANNER_FOCAL_INVALID', 'EVENT_FILE_INACTIVE', 'EVENT_FILE_FORBIDDEN', 'EVENT_FILE_NOT_FOUND'])('preserves files on banner rejection: %s', async message => {
    const { client, storage } = mockClient({ set_event_banner_focal_point: fail(message) })
    expect((await updateApiEventBanner(client, eventId, { file_id: fileId })).error).not.toBeNull()
    expect(storage.remove).not.toHaveBeenCalled()
  })
  it.each([
    null,
    { file_id: fileId },
    { file_id: null, focal_x: 0.5, focal_y: 0.5 },
    { file_id: fileId, focal_x: -0.1, focal_y: 0.5 },
    { file_id: fileId, focal_x: 0.5, focal_y: 'not-a-number' },
  ])('rejects malformed banner RPC responses: %o', async response => {
    const { client } = mockClient({ set_event_banner_focal_point: ok(response) })
    expect((await updateApiEventBanner(client, eventId, { file_id: fileId })).error?.kind).toBe('database')
  })
  it('rejects invalid banner UUIDs before reaching the database', async () => {
    const { client, rpc } = mockClient()
    expect((await updateApiEventBanner(client, eventId, { file_id: 'bad' })).error?.kind).toBe('validation')
    expect((await updateApiEventBanner(client, 'bad', { file_id: null })).error?.kind).toBe('validation')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('reserves server-owned metadata before signing an upload without overwrite', async () => {
    const { client, rpc, storage } = mockClient({ create_event_file_upload: ok({ ...file, expires_at: '2026-09-08T12:00:00Z' }) })
    const result = await createApiEventFileUploadSession(client, eventId, metadata)
    expect(rpc).toHaveBeenCalledWith('create_event_file_upload', { p_event_id: eventId, p_file_name: metadata.file_name, p_content_type: metadata.content_type, p_size_bytes: 100 })
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(objectPath, { upsert: false })
    expect(result.data).toMatchObject({ upload_id: fileId, object_path: objectPath, upload_url: 'https://storage.example/upload' })
  })
  it.each(['EVENT_FILE_FORBIDDEN', 'EVENT_FILE_INACTIVE', 'EVENT_FILE_LIMIT_REACHED'])('never signs when the database rejects %s', async message => {
    const { client, storage } = mockClient({ create_event_file_upload: fail(message) })
    expect((await createApiEventFileUploadSession(client, eventId, metadata)).error).not.toBeNull()
    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled()
  })
  it('releases the reservation when upload URL creation fails', async () => {
    const { client, rpc, storage } = mockClient({ create_event_file_upload: ok(file), prepare_event_file_removal: ok(objectPath) })
    storage.createSignedUploadUrl.mockResolvedValue(fail('storage unavailable'))
    expect((await createApiEventFileUploadSession(client, eventId, metadata)).error).not.toBeNull()
    expect(rpc).toHaveBeenLastCalledWith('prepare_event_file_removal', { p_event_id: eventId, p_file_id: fileId, p_pending_only: true })
    expect(storage.remove).toHaveBeenCalledWith([objectPath])
  })
  it('returns the verified file and converts database bigint sizes to numbers', async () => {
    const { client, storage } = mockClient({ finalize_event_file_upload: ok({ ...file, size_bytes: '100' }) })
    expect(await finalizeApiEventFile(client, eventId, { upload_id: fileId })).toEqual(ok(file))
    expect(storage.remove).not.toHaveBeenCalled()
  })
  it.each(['EVENT_FILE_UPLOAD_MISMATCH', 'EVENT_FILE_INACTIVE', 'EVENT_FILE_UPLOAD_MISSING', 'EVENT_FILE_LIMIT_REACHED'])('cleans up owned pending bytes after %s', async message => {
    const { client, storage } = mockClient({ finalize_event_file_upload: fail(message), prepare_event_file_removal: ok(objectPath) })
    expect((await finalizeApiEventFile(client, eventId, { upload_id: fileId })).error).not.toBeNull()
    expect(storage.remove).toHaveBeenCalledWith([objectPath])
  })
  it('does not remove bytes when cleanup finds a published or unowned session', async () => {
    const { client, storage } = mockClient({ finalize_event_file_upload: fail('network result uncertain'), prepare_event_file_removal: ok(null) })
    await finalizeApiEventFile(client, eventId, { upload_id: fileId })
    expect(storage.remove).not.toHaveBeenCalled()
  })
  it.each(['error', 'throw'] as const)('never advertises destructive cleanup when the pending-only claim has an uncertain %s', async mode => {
    const { client, rpc, storage } = mockClient({
      finalize_event_file_upload: fail('finalisation response lost'),
      prepare_event_file_removal: fail('cleanup response lost'),
    })
    if (mode === 'throw') {
      const defaultRpc = rpc.getMockImplementation()!
      rpc.mockImplementation(name => {
        if (name === 'prepare_event_file_removal') throw new Error('cleanup connection lost')
        return defaultRpc(name)
      })
    }
    // Finalisation may already have committed. A normal remove retry could
    // delete that published file, so only a same-ID finalisation is safe here.
    const result = await finalizeApiEventFile(client, eventId, { upload_id: fileId })
    expect(result.error).toMatchObject({
      kind: 'business', code: 'INTERNAL_ERROR', retryable: true,
    })
    expect(result.error).not.toHaveProperty('details.cleanup_pending')
    expect(storage.remove).not.toHaveBeenCalled()
  })
  it('retains a confirmed cleanup claim when physical deletion throws', async () => {
    const { client, storage } = mockClient({
      finalize_event_file_upload: fail('EVENT_FILE_UPLOAD_MISMATCH'),
      prepare_event_file_removal: ok(objectPath),
    })
    storage.remove.mockRejectedValue(new Error('storage connection lost'))
    expect((await finalizeApiEventFile(client, eventId, { upload_id: fileId })).error).toMatchObject({
      details: { event_id: eventId, upload_id: fileId, cleanup_pending: true },
    })
  })
  it('returns a usable cleanup ID when physical deletion fails', async () => {
    const { client, storage } = mockClient({ finalize_event_file_upload: fail('EVENT_FILE_UPLOAD_MISMATCH'), prepare_event_file_removal: ok(objectPath) })
    storage.remove.mockResolvedValue(fail('storage unavailable'))
    expect((await finalizeApiEventFile(client, eventId, { upload_id: fileId })).error).toMatchObject({ details: { event_id: eventId, upload_id: fileId, cleanup_pending: true } })
  })
  it('handles a thrown finalisation error through guarded cleanup', async () => {
    const { client, rpc, storage } = mockClient({ prepare_event_file_removal: ok(objectPath) })
    rpc.mockImplementationOnce(() => { throw new Error('connection lost') })
    expect((await finalizeApiEventFile(client, eventId, { upload_id: fileId })).error).not.toBeNull()
    expect(storage.remove).toHaveBeenCalledWith([objectPath])
  })
  it('scopes access by event and file ID and signs for only five minutes', async () => {
    const { client, query, storage } = mockClient({}, ok(file))
    expect((await createApiEventFileAccess(client, eventId, fileId)).data).toMatchObject({ file_id: fileId, download_url: 'https://storage.example/read' })
    expect(query.eq.mock.calls).toEqual([['event_id', eventId], ['id', fileId]])
    expect(storage.createSignedUrl).toHaveBeenCalledWith(objectPath, 300)
  })
  it('adds compressed private gallery and banner URLs for images', async () => {
    const { client, storage } = mockClient({}, ok(image))
    storage.createSignedUrl
      .mockResolvedValueOnce(ok({ signedUrl: 'https://storage.example/original' }))
      .mockResolvedValueOnce(ok({ signedUrl: 'https://storage.example/thumbnail' }))
      .mockResolvedValueOnce(ok({ signedUrl: 'https://storage.example/banner' }))
    expect((await createApiEventFileAccess(client, eventId, fileId)).data).toMatchObject({
      file_id: fileId,
      download_url: 'https://storage.example/original',
      thumbnail_url: 'https://storage.example/thumbnail',
      banner_thumbnail_url: 'https://storage.example/banner',
    })
    expect(storage.createSignedUrl).toHaveBeenNthCalledWith(1, imagePath, 300)
    expect(storage.createSignedUrl).toHaveBeenNthCalledWith(2, imagePath, 300, { transform: EVENT_FILE_THUMBNAIL_TRANSFORM })
    expect(storage.createSignedUrl).toHaveBeenNthCalledWith(3, imagePath, 300, { transform: EVENT_FILE_BANNER_TRANSFORM })
    expect(EVENT_FILE_BANNER_TRANSFORM).toEqual({ width: 1280, resize: 'contain', quality: 60 })
    expect(EVENT_FILE_BANNER_TRANSFORM).not.toHaveProperty('height')
  })
  it('does not substitute original bytes when image transformation is unavailable', async () => {
    const { client, storage } = mockClient({}, ok(image))
    storage.createSignedUrl
      .mockResolvedValueOnce(ok({ signedUrl: 'https://storage.example/original' }))
      .mockResolvedValueOnce(fail('thumbnail transform unavailable'))
      .mockResolvedValueOnce(fail('banner transform unavailable'))
    expect((await createApiEventFileAccess(client, eventId, fileId)).data).toEqual({
      file_id: fileId,
      download_url: 'https://storage.example/original',
      expires_at: expect.any(String),
    })
  })
  it('does not sign an inaccessible, pending, or cross-event file', async () => {
    const { client, storage } = mockClient()
    expect((await createApiEventFileAccess(client, eventId, fileId)).error).toMatchObject({ code: 'NOT_FOUND' })
    expect(storage.createSignedUrl).not.toHaveBeenCalled()
  })
  it('requires a database removal claim before removing bytes', async () => {
    const { client, storage } = mockClient({ prepare_event_file_removal: fail('EVENT_FILE_FORBIDDEN') })
    expect((await removeApiEventFile(client, eventId, fileId)).error).toMatchObject({ code: 'FORBIDDEN' })
    expect(storage.remove).not.toHaveBeenCalled()
  })
  it('retries storage cleanup with the same file ID', async () => {
    const { client, storage } = mockClient({ prepare_event_file_removal: ok(objectPath) })
    storage.remove.mockResolvedValueOnce(fail('storage unavailable'))
    expect((await removeApiEventFile(client, eventId, fileId)).error).not.toBeNull()
    expect(await removeApiEventFile(client, eventId, fileId)).toEqual(ok({ file_id: fileId }))
    expect(storage.remove).toHaveBeenCalledTimes(2)
  })
  it('returns a deterministically ordered file list for the workspace', async () => {
    const { client, query } = mockClient({}, ok([{ ...file, size_bytes: '100' }]))
    expect(await listApiEventFiles(client, eventId)).toEqual(ok([file]))
    expect(query.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]])
  })
  it('rejects malformed IDs before database or storage operations', async () => {
    const { client, rpc, storage } = mockClient()
    expect((await finalizeApiEventFile(client, '../bad', { upload_id: fileId })).error?.kind).toBe('validation')
    expect((await removeApiEventFile(client, eventId, 'bad')).error?.kind).toBe('validation')
    expect(rpc).not.toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
  })
})
