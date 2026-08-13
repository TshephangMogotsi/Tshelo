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
  receivedAt:  string        // ISO timestamp
  detectionKey?: string      // stable identity used to prevent double-recording
}

export function getDetectedSmsKey(detected: DetectedSms): string {
  if (detected.detectionKey) return detected.detectionKey
  return [
    'sms',
    detected.receivedAt,
    detected.provider ?? 'unknown',
    detected.reference ?? 'no-reference',
    detected.senderPhone ?? detected.senderName ?? 'unknown-sender',
    detected.amount.toFixed(2),
  ].map(encodeURIComponent).join('|')
}

export function detectMoneyIn(sender: string, body: string): DetectedSms | null {
  const receivedAt = new Date().toISOString()

  const parsed = parseMobileMoneySms(body, sender)
  if (parsed && parsed.direction === 'received') {
    const detected: DetectedSms = {
      amount:      parsed.amount,
      senderName:  parsed.counterpartyName,
      senderPhone: parsed.counterpartyPhone,
      provider:    parsed.provider,
      reference:   parsed.reference,
      receivedAt,
    }
    return { ...detected, detectionKey: getDetectedSmsKey(detected) }
  }

  return null
}

export function describeSender(detected: DetectedSms) {
  return detected.senderName ?? detected.senderPhone ?? 'an unknown sender'
}

async function notifyDetected(detected: DetectedSms, userId: string) {
  if (!userId) return
  const normalized = { ...detected, detectionKey: getDetectedSmsKey(detected) }
  const via = detected.provider ? ` via ${PROVIDER_LABELS[detected.provider]}` : ''
  const title = `P${detected.amount.toLocaleString('en-BW')} received 💰`
  const body  = `From ${describeSender(detected)}${via}. Tap to add it to a fund or event.`

  // Create the in-app row through a server-owned function first, so both the
  // system notification and Notifications screen carry the same record ID.
  const { data: notificationId } = await supabase.rpc('create_sms_detected_notification', {
    p_detected: normalized,
  })

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        detectedSms: normalized,
        ...(typeof notificationId === 'string' ? { notificationId } : {}),
      },
    },
    trigger: null, // fire immediately
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
