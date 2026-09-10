jest.mock('server-only', () => ({}), { virtual: true })

import { validateSetEventAnnouncementPinRequest } from '../../admin/lib/api/validation'
import { setApiEventAnnouncementPin } from '../../admin/lib/data/api-events'

type SupabaseClient = Parameters<typeof setApiEventAnnouncementPin>[0]
const eventId = '11111111-1111-4111-8111-111111111111'
const announcementId = '22222222-2222-4222-8222-222222222222'
const announcement = {
  id: announcementId,
  event_id: eventId,
  author_id: '33333333-3333-4333-8333-333333333333',
  author_name: 'Kago',
  title: 'Venue changed',
  body: 'Use the north entrance.',
  is_pinned: true,
  attachments: [],
  created_at: '2026-09-09T10:00:00Z',
}

type Reply<T> = { data: T; error: { message: string } | null }

function mockClient(
  rpcReply: Reply<boolean | null> = { data: true, error: null },
  queryReply: Reply<typeof announcement | null> = { data: announcement, error: null },
) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(queryReply),
  }
  const rpc = jest.fn().mockResolvedValue(rpcReply)
  const client = { rpc, from: jest.fn(() => query) }
  return { client: client as unknown as SupabaseClient, rpc, query }
}

describe('event announcement pin API', () => {
  it('accepts only an explicit boolean pin state', () => {
    expect(validateSetEventAnnouncementPinRequest({ is_pinned: true })).toEqual({ ok: true, value: { is_pinned: true } })
    for (const body of [null, {}, { is_pinned: 'true' }, { is_pinned: true, event_id: eventId }]) {
      expect(validateSetEventAnnouncementPinRequest(body).ok).toBe(false)
    }
  })

  it('returns the atomic acknowledgement without a failure-prone post-commit read', async () => {
    const { client, rpc } = mockClient()
    await expect(setApiEventAnnouncementPin(client, eventId, announcementId, { is_pinned: true }))
      .resolves.toEqual({ data: { announcement_id: announcementId, is_pinned: true }, error: null })
    expect(rpc).toHaveBeenCalledWith('set_event_announcement_pin', {
      p_event_id: eventId,
      p_announcement_id: announcementId,
      p_is_pinned: true,
    })
    expect(client.from).not.toHaveBeenCalled()
  })

  it.each([
    ['EVENT_ANNOUNCEMENT_FORBIDDEN', 'FORBIDDEN'],
    ['EVENT_ANNOUNCEMENT_INACTIVE', 'CONFLICT'],
    ['EVENT_ANNOUNCEMENT_NOT_FOUND', 'NOT_FOUND'],
  ])('maps %s to a safe API error', async (message, code) => {
    const { client } = mockClient({ data: null, error: { message } })
    expect((await setApiEventAnnouncementPin(client, eventId, announcementId, { is_pinned: true })).error)
      .toMatchObject({ kind: 'business', code })
  })

  it('rejects invalid IDs without calling the database', async () => {
    const { client, rpc } = mockClient()
    expect((await setApiEventAnnouncementPin(client, 'bad', announcementId, { is_pinned: true })).error?.kind).toBe('validation')
    expect((await setApiEventAnnouncementPin(client, eventId, 'bad', { is_pinned: true })).error?.kind).toBe('validation')
    expect(rpc).not.toHaveBeenCalled()
  })
})
