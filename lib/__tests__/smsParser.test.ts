import { parseMobileMoneySms } from '../smsParser'

// ⚠️ Fixtures are PROVISIONAL formats — replace/extend with real captured
// messages from Orange Money, MyZaka, and Smega as they're collected.

describe('parseMobileMoneySms — Orange Money', () => {
  it('parses a standard received message', () => {
    const result = parseMobileMoneySms(
      'Orange Money: You have received P500.00 from KGOSI MOENG 71234567. Ref: OM240705.C12345. Your new balance is P1,250.50.',
    )
    expect(result).toEqual({
      provider: 'orange_money',
      direction: 'received',
      amount: 500,
      counterpartyName: 'KGOSI MOENG',
      counterpartyPhone: '71234567',
      reference: 'OM240705.C12345',
      balance: 1250.5,
    })
  })

  it('detects the provider from the sender ID when the body has no brand name', () => {
    const result = parseMobileMoneySms(
      'You have received 250.00 BWP from 72 345 678. Ref: 998877. Balance: 400.00 BWP.',
      'OrangeMoney',
    )
    expect(result?.provider).toBe('orange_money')
    expect(result?.amount).toBe(250)
    expect(result?.counterpartyPhone).toBe('72345678')
  })

  it('parses a sent (outgoing) message', () => {
    const result = parseMobileMoneySms(
      'Orange Money: You have sent P1,500.00 to NALEDI PHIRI 76123456. Ref: OM11223. Balance: P95.20.',
    )
    expect(result?.direction).toBe('sent')
    expect(result?.amount).toBe(1500)
    expect(result?.counterpartyName).toBe('NALEDI PHIRI')
  })
})

describe('parseMobileMoneySms — MyZaka', () => {
  it('parses a received message with transaction ID', () => {
    const result = parseMobileMoneySms(
      'MyZaka: You have received P750.00 from 74123456 MPHO SEFUTHI. Transaction ID: MZ98765432. New balance: P2,100.00.',
    )
    expect(result?.provider).toBe('myzaka')
    expect(result?.direction).toBe('received')
    expect(result?.amount).toBe(750)
    expect(result?.counterpartyPhone).toBe('74123456')
    expect(result?.reference).toBe('MZ98765432')
    expect(result?.balance).toBe(2100)
  })

  it('detects Mascom sender hint', () => {
    const result = parseMobileMoneySms(
      'You have received P50.00 from 75987654. Txn 445566.',
      'Mascom',
    )
    expect(result?.provider).toBe('myzaka')
    expect(result?.reference).toBe('445566')
    expect(result?.balance).toBeNull()
  })
})

describe('parseMobileMoneySms — Smega', () => {
  it('parses a received message', () => {
    const result = parseMobileMoneySms(
      'Smega: P300.00 received from 77123456 BOITUMELO SITHOLE. Ref 5544332211. Bal: P820.75.',
    )
    expect(result?.provider).toBe('smega')
    expect(result?.direction).toBe('received')
    expect(result?.amount).toBe(300)
    expect(result?.counterpartyPhone).toBe('77123456')
    expect(result?.balance).toBe(820.75)
  })

  it('handles country-code phone formats', () => {
    const result = parseMobileMoneySms(
      'Smega: You have received P100.00 from +267 77 123 456. Ref 12345.',
    )
    expect(result?.counterpartyPhone).toBe('77123456')
  })
})

describe('parseMobileMoneySms — rejects and edge cases', () => {
  it('returns null for non-money SMS', () => {
    expect(parseMobileMoneySms('Your OTP code is 123456')).toBeNull()
    expect(parseMobileMoneySms('Dumela! Re a leboga.')).toBeNull()
    expect(parseMobileMoneySms('')).toBeNull()
  })

  it('returns null when no provider can be identified', () => {
    expect(
      parseMobileMoneySms('You have received P500.00 from KGOSI 71234567.'),
    ).toBeNull()
  })

  it('returns null for provider messages without a money movement', () => {
    expect(
      parseMobileMoneySms('Orange Money: Your PIN was changed successfully.'),
    ).toBeNull()
  })

  it('handles comma-grouped thousands', () => {
    const result = parseMobileMoneySms(
      'Orange Money: You have received P12,500.00 from TEBOGO MOTSEPE 71987654. Ref: OM777.',
    )
    expect(result?.amount).toBe(12500)
  })

  it('does not mistake the balance for the amount', () => {
    const result = parseMobileMoneySms(
      'MyZaka: You have received P20.00 from 74555666. New balance: P9,999.99.',
    )
    expect(result?.amount).toBe(20)
    expect(result?.balance).toBe(9999.99)
  })

  it('survives extra whitespace and line breaks', () => {
    const result = parseMobileMoneySms(
      'Orange Money:\nYou have received  P75.50\nfrom KAGO   MODISE 73111222.\nRef: OM4321.',
    )
    expect(result?.amount).toBe(75.5)
    expect(result?.counterpartyName).toBe('KAGO MODISE')
  })
})
