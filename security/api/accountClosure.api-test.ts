jest.mock('server-only', () => ({}), { virtual: true })

import {
  getApiAccountClosureRequest,
  requestApiAccountClosure,
} from '../../admin/lib/data/api-account'

type SupabaseClient = Parameters<typeof getApiAccountClosureRequest>[0]

const actorUserId = '11111111-1111-4111-8111-111111111111'
const request = {
  id: '22222222-2222-4222-8222-222222222222',
  ticket_number: 'TSH-1001',
  status: 'open',
  created_at: '2026-09-11T09:00:00.000Z',
}

function readBuilder(data: typeof request | null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
  }
}

function insertBuilder() {
  return {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: request, error: null }),
  }
}

describe('account closure API data service', () => {
  it('returns only the caller-owned active closure request', async () => {
    const query = readBuilder(request)
    const client = { from: jest.fn(() => query) } as unknown as SupabaseClient

    await expect(getApiAccountClosureRequest(client, actorUserId)).resolves.toEqual({
      data: request,
      error: null,
    })
    expect(query.eq).toHaveBeenCalledWith('user_id', actorUserId)
    expect(query.eq).toHaveBeenCalledWith('category', 'account_closure')
    expect(query.in).toHaveBeenCalledWith('status', ['open', 'pending', 'in_progress'])
  })

  it('returns an existing request without inserting a duplicate', async () => {
    const query = readBuilder(request)
    const from = jest.fn(() => query)
    const client = { from } as unknown as SupabaseClient

    await expect(requestApiAccountClosure(client, actorUserId)).resolves.toEqual({
      data: request,
      error: null,
    })
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('creates an actor-owned support ticket when no request is active', async () => {
    const query = readBuilder(null)
    const insert = insertBuilder()
    const from = jest.fn()
      .mockReturnValueOnce(query)
      .mockReturnValueOnce(insert)
    const client = { from } as unknown as SupabaseClient

    await expect(requestApiAccountClosure(client, actorUserId)).resolves.toEqual({
      data: request,
      error: null,
    })
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: actorUserId,
      category: 'account_closure',
      subject: 'Account closure request',
      status: 'open',
    }))
  })
})
