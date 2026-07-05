import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
})

async function getProjectPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) return null

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
    return data
  } catch {
    return null
  }
}

// Requests permission (if needed) and upserts this device's Expo push
// token against the signed-in user. Safe to call on every app start —
// it's a no-op past the first successful run on a given device.
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  if (Platform.OS === 'android') {
    // MAX importance = heads-up banner; channel settings are immutable
    // per-device once created, so this must be right on first install
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7439E0',
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return

  const expoPushToken = await getProjectPushToken()
  if (!expoPushToken) return

  await supabase.from('push_tokens').upsert(
    {
      user_id:         userId,
      expo_push_token: expoPushToken,
      platform:        Platform.OS,
      updated_at:       new Date().toISOString(),
    },
    { onConflict: 'expo_push_token' }
  )
}

// Removes this device's token so a signed-out account stops receiving
// push on a device that may go on to be used by someone else.
export async function unregisterPushToken(): Promise<void> {
  const expoPushToken = await getProjectPushToken()
  if (!expoPushToken) return
  await supabase.from('push_tokens').delete().eq('expo_push_token', expoPushToken)
}
