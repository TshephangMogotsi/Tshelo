// The watcher module pulls in the supabase client (native storage + env
// vars) for its notification side effects; the pure detection logic under
// test here doesn't need it.
jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }))

import { detectMoneyIn, describeSender, getDetectedSmsKey } from '../smsWatcher'

describe('detectMoneyIn', () => {
  it('does not enable the old production test trigger', () => {
    expect(detectMoneyIn('+26771234567', 'Hello Tshelo 350.50')).toBeNull()
  })

  it('prefers the real parser for provider messages', () => {
    const detected = detectMoneyIn(
      'OrangeMoney',
      'You have received P500.00 from KGOSI MOENG 71234567. Ref OM12345. Balance P1,250.00'
    )
    expect(detected).not.toBeNull()
    expect(detected!.amount).toBe(500)
    expect(detected!.provider).toBe('orange_money')
    expect(detected!.senderName).toBe('KGOSI MOENG')
    expect(detected!.detectionKey).toBe(getDetectedSmsKey(detected!))
    expect(detected).not.toHaveProperty('smsBody')
  })

  it('ignores money-out provider messages', () => {
    const detected = detectMoneyIn('OrangeMoney', 'You sent P200.00 to Naledi Phiri. Balance P50.00')
    expect(detected).toBeNull()
  })

  it('ignores unrelated messages', () => {
    expect(detectMoneyIn('+26771234567', 'Hey, are we still on for tonight?')).toBeNull()
  })
})

describe('getDetectedSmsKey', () => {
  it('returns the same identity for repeat taps on the same detection', () => {
    const detected = {
      amount: 250,
      senderName: 'Kgosi',
      senderPhone: '71234567',
      provider: 'orange_money' as const,
      reference: 'OM123',
      receivedAt: '2026-07-22T10:00:00.000Z',
    }
    expect(getDetectedSmsKey(detected)).toBe(getDetectedSmsKey({ ...detected }))
  })
})

describe('describeSender', () => {
  it('prefers name, then phone, then a fallback', () => {
    const base = { amount: 1, provider: null, reference: null, receivedAt: '' }
    expect(describeSender({ ...base, senderName: 'Kgosi', senderPhone: '712' })).toBe('Kgosi')
    expect(describeSender({ ...base, senderName: null, senderPhone: '712' })).toBe('712')
    expect(describeSender({ ...base, senderName: null, senderPhone: null })).toBe('an unknown sender')
  })
})
