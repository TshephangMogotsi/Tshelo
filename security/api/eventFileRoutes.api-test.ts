jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('../../admin/lib/api/auth', () => ({ authenticateApiRequest: jest.fn() }))
jest.mock('../../admin/lib/data/api', () => ({
  createApiEventFileUploadSession: jest.fn(), finalizeApiEventFile: jest.fn(),
  createApiEventFileAccess: jest.fn(), removeApiEventFile: jest.fn(),
}))

import { webcrypto } from 'node:crypto'
import { authenticateApiRequest } from '../../admin/lib/api/auth'
import { createApiEventFileUploadSession, finalizeApiEventFile, createApiEventFileAccess, removeApiEventFile } from '../../admin/lib/data/api'
import { POST as upload } from '../../admin/app/api/v1/events/[eventId]/files/upload-session/route'
import { POST as finalize } from '../../admin/app/api/v1/events/[eventId]/files/finalize/route'
import { POST as access } from '../../admin/app/api/v1/events/[eventId]/files/[fileId]/access/route'
import { DELETE as remove } from '../../admin/app/api/v1/events/[eventId]/files/[fileId]/route'

const eventId = '11111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'
const client = { test: 'caller-scoped client' }
const auth = jest.mocked(authenticateApiRequest)
const operations = [
  { handler: upload, service: jest.mocked(createApiEventFileUploadSession), method: 'POST', body: { file_name: 'Plan.pdf', content_type: 'application/pdf', size_bytes: 100 }, status: 201 },
  { handler: finalize, service: jest.mocked(finalizeApiEventFile), method: 'POST', body: { upload_id: fileId }, status: 200 },
  { handler: access, service: jest.mocked(createApiEventFileAccess), method: 'POST', body: undefined, status: 201 },
  { handler: remove, service: jest.mocked(removeApiEventFile), method: 'DELETE', body: undefined, status: 200 },
]
const context = { params: Promise.resolve({ eventId, fileId }) }

beforeAll(() => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }) })
beforeEach(() => jest.resetAllMocks())

describe('event file route boundary', () => {
  it.each(operations)('authenticates $method before parsing input or resolving params', async ({ handler, method, service }) => {
    auth.mockResolvedValue({ ok: false, status: 401, error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', retryable: false } })
    const request = new Request('https://api.example/files', { method })
    const bodyRead = jest.spyOn(request, 'text')
    const params = { get params(): never { throw new Error('Must authenticate first') } }
    // Route parameter promises must not be resolved for an unauthenticated user.
    const response = await handler(request, { params: { then: () => params.params } as unknown as typeof context.params })
    expect(response.status).toBe(401)
    expect(bodyRead).not.toHaveBeenCalled()
    expect(service).not.toHaveBeenCalled()
  })
  it.each(operations)('returns a no-store response from the caller-scoped $method operation', async ({ handler, method, service, body, status }) => {
    auth.mockResolvedValue({ ok: true, auth: { supabase: client, actor: { user_id: fileId } } } as never)
    service.mockResolvedValue({ data: { file_id: fileId }, error: null } as never)
    const request = new Request('https://api.example/files', { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const response = await handler(request, context)
    expect(response.status).toBe(status)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(service.mock.calls[0][0]).toBe(client)
    expect(service.mock.calls[0][1]).toBe(eventId)
    expect(await response.json()).toMatchObject({ ok: true, data: { file_id: fileId } })
  })
  it('rejects forged finalisation metadata before calling the data service', async () => {
    auth.mockResolvedValue({ ok: true, auth: { supabase: client } } as never)
    const request = new Request('https://api.example/files/finalize', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upload_id: fileId, object_path: 'another/event/file.pdf' }),
    })
    expect((await finalize(request, context)).status).toBe(422)
    expect(finalizeApiEventFile).not.toHaveBeenCalled()
  })
  it('preserves cleanup recovery details in the error envelope', async () => {
    auth.mockResolvedValue({ ok: true, auth: { supabase: client } } as never)
    jest.mocked(finalizeApiEventFile).mockResolvedValue({
      data: null, error: { kind: 'business', code: 'CONFLICT', message: 'Cleanup pending.', details: { upload_id: fileId, cleanup_pending: true } },
    })
    const request = new Request('https://api.example/files/finalize', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ upload_id: fileId }),
    })
    const response = await finalize(request, context)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ ok: false, error: { details: { upload_id: fileId, cleanup_pending: true } } })
  })
})
