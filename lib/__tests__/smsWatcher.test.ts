// The watcher module pulls in the supabase client (native storage + env
// vars) for its notification side effects; the pure detection logic under
// test here doesn't need it.
jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }))

import { detectMoneyIn, describeSender } from '../smsWatcher'

describe('detectMoneyIn', () => {
  it('detects the "Hello Tshelo" test trigger with the default P200', () => {
    const detected = detectMoneyIn('+26771234567', 'Hello Tshelo')
    expect(detected).not.toBeNull()
    expect(detected!.amount).toBe(200)
    expect(detected!.senderPhone).toBe('+26771234567')
    expect(detected!.provider).toBeNull()
  })

  it('accepts a custom amount in the test trigger', () => {
    const detected = detectMoneyIn('+26771234567', 'hello tshelo 350.50')
    expect(detected!.amount).toBe(350.5)
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
  })

  it('ignores money-out provider messages', () => {
    const detected = detectMoneyIn('OrangeMoney', 'You sent P200.00 to Naledi Phiri. Balance P50.00')
    expect(detected).toBeNull()
  })

  it('ignores unrelated messages', () => {
    expect(detectMoneyIn('+26771234567', 'Hey, are we still on for tonight?')).toBeNull()
  })
})

describe('describeSender', () => {
  it('prefers name, then phone, then a fallback', () => {
    const base = { amount: 1, provider: null, reference: null, smsBody: '', receivedAt: '' }
    expect(describeSender({ ...base, senderName: 'Kgosi', senderPhone: '712' })).toBe('Kgosi')
    expect(describeSender({ ...base, senderName: null, senderPhone: '712' })).toBe('712')
    expect(describeSender({ ...base, senderName: null, senderPhone: null })).toBe('an unknown sender')
  })
})
