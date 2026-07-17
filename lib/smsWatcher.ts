import { PermissionsAndroid, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { addSmsListener } from '../modules/sms-listener'
import { parseMobileMoneySms } from './smsParser'
import { PROVIDER_LABELS } from './providers'
import { supabase } from './supabase'
import type { MobileMoneyProvider } from './providers'
import type { EventSubscription } from 'expo-modules-core'

// A money-in SMS the watcher recognised. Serialisable — it travels
// through the notification data payload into AssignContribution.
export type DetectedSms = {
  amount:      number        // in Pula
  senderName:  string | null
  senderPhone: string | null
  provider:    MobileMoneyProvider | null
  reference:   string | null
  smsBody:     string
  receivedAt:  string        // ISO timestamp
}

// ⚠️ Test scaffold alongside the real parser: "Hello Tshelo" (optionally
// "Hello Tshelo 350") simulates a received payment — P200 by default —
// so the flow can be exercised without a real mobile-money SMS.
const TEST_TRIGGER = /hello\s+tshelo(?:\s+(\d+(?:\.\d{1,2})?))?/i

export function detectMoneyIn(sender: string, body: string): DetectedSms | null {
  const receivedAt = new Date().toISOString()

  const parsed = parseMobileMoneySms(body, sender)
  if (parsed && parsed.direction === 'received') {
    return {
      amount:      parsed.amount,
      senderName:  parsed.counterpartyName,
      senderPhone: parsed.counterpartyPhone,
      provider:    parsed.provider,
      reference:   parsed.reference,
      smsBody:     body,
      receivedAt,
    }
  }

  const test = body.match(TEST_TRIGGER)
  if (test) {
    return {
      amount:      test[1] ? parseFloat(test[1]) : 200,
      senderName:  null,
      senderPhone: sender || null,
      provider:    null,
      reference:   null,
      smsBody:     body,
      receivedAt,
    }
  }

  return null
}

export function describeSender(detected: DetectedSms) {
  return detected.senderName ?? detected.senderPhone ?? 'an unknown sender'
}

async function notifyDetected(detected: DetectedSms, userId: string) {
  const via = detected.provider ? ` via ${PROVIDER_LABELS[detected.provider]}` : ''
  const title = `P${detected.amount.toLocaleString('en-BW')} received 💰`
  const body  = `From ${describeSender(detected)}${via}. Tap to add it to a fund or event.`

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { detectedSms: detected } },
    trigger: null, // fire immediately
  })

  // Also land in the in-app notifications list for anyone who missed the
  // banner. suppress_push tells send-push not to notify a second time.
  await supabase.from('notifications').insert({
    user_id: userId,
    type:    'sms_detected',
    title,
    body,
    data:    { detectedSms: detected, suppress_push: true },
  })
}

// Requests the SMS permission and starts watching incoming messages.
// Returns the subscription (remove() to stop), or null when unavailable
// (iOS, permission denied, or module missing from the native build).
export async function startSmsWatcher(userId: string): Promise<EventSubscription | null> {
  if (Platform.OS !== 'android') return null

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    {
      title:   'Detect mobile-money messages',
      message: 'Tshelo reads incoming SMS to automatically detect mobile-money contributions.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    }
  )
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) return null

  return addSmsListener(async ({ sender, body }) => {
    const detected = detectMoneyIn(sender, body)
    if (detected) await notifyDetected(detected, userId)
  })
}
