import { PermissionsAndroid, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { addSmsListener } from '../modules/sms-listener'
import type { EventSubscription } from 'expo-modules-core'

// ⚠️ Test scaffold: fires a notification for any SMS containing
// "Hello Tshelo". Once real provider formats are confirmed, route the
// body through parseMobileMoneySms() instead of this keyword check.
const TEST_TRIGGER = /hello\s+tshelo/i

// Requests the SMS permission and starts watching incoming messages.
// Returns the subscription (remove() to stop), or null when unavailable
// (iOS, permission denied, or module missing from the native build).
export async function startSmsWatcher(): Promise<EventSubscription | null> {
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
    if (!TEST_TRIGGER.test(body)) return
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SMS detected 🎉',
        body:  `From ${sender}: ${body}`,
      },
      trigger: null, // fire immediately
    })
  })
}
