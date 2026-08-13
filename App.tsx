import { useEffect, useState } from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_400Regular_Italic } from '@expo-google-fonts/inter/400Regular_Italic'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold'
import { Inter_900Black } from '@expo-google-fonts/inter/900Black'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ConnectivityProvider } from './context/ConnectivityContext'
import { RewardsProvider } from './context/RewardsContext'
import OfflineBanner from './components/OfflineBanner'
import ErrorBoundary from './components/ErrorBoundary'
import AuthNavigator from './navigation/AuthNavigator'
import MainNavigator from './navigation/MainNavigator'
import OnboardingScreen from './screens/onboarding/OnboardingScreen'
import { registerForPushNotificationsAsync } from './lib/pushNotifications'
import { startSmsWatcher } from './lib/smsWatcher'
import { supabase } from './lib/supabase'
import { appLinking } from './navigation/linking'
import type { MainStackParamList } from './navigation/types'

const ONBOARDING_KEY = 'tshelo_onboarded_v1'

// Keep the native splash visible until fonts + onboarding state are ready
SplashScreen.preventAutoHideAsync()
SplashScreen.setOptions({ fade: true, duration: 300 })

export const navigationRef = createNavigationContainerRef<MainStackParamList>()

function openRewards() {
  if (navigationRef.isReady()) navigationRef.navigate('Rewards')
}

async function navigateFromNotificationData(data: Record<string, any> | undefined) {
  if (!navigationRef.isReady()) return
  if (data?.kind === 'reward_earned' || data?.kind === 'trust_level_changed') {
    navigationRef.navigate('Rewards')
    return
  }
  if (data?.kind === 'event_announcement' && typeof data.eventId === 'string') {
    navigationRef.navigate('EventDetail', { eventId: data.eventId, tab: 'announcements' })
    return
  }
  const detected = data?.detectedSms
  if (detected && typeof detected.amount === 'number' && typeof detected.receivedAt === 'string') {
    const notificationId = typeof data?.notificationId === 'string' ? data.notificationId : undefined
    if (notificationId) {
      const { data: notification } = await supabase
        .from('notifications')
        .select('fund_id, response_action, data')
        .eq('id', notificationId)
        .maybeSingle()
      const recordedFundId = notification?.fund_id ?? notification?.data?.recordedFundId
      if (notification?.response_action === 'recorded' && typeof recordedFundId === 'string') {
        if (navigationRef.isReady()) navigationRef.navigate('FundDetail', { fundId: recordedFundId })
        return
      }
    }
    if (navigationRef.isReady()) navigationRef.navigate('AssignContribution', { detected, notificationId })
    return
  }
  const fundId = data?.fundId
  if (typeof fundId === 'string') {
    navigationRef.navigate('FundDetail', { fundId })
  } else {
    navigationRef.navigate('Notifications')
  }
}

function RootNavigator({ initialAuthRoute }: { initialAuthRoute: 'Welcome' | 'CountrySelect' | 'Login' }) {
  const { isAuthenticated, profileCompleted, userId } = useAuth()

  useEffect(() => {
    if (isAuthenticated && profileCompleted && userId) {
      registerForPushNotificationsAsync(userId)
    }
  }, [isAuthenticated, profileCompleted, userId])

  useEffect(() => {
    if (!isAuthenticated || !profileCompleted || !userId) return
    const watcher = startSmsWatcher(userId)
    return () => {
      watcher.then(subscription => subscription?.remove())
    }
  }, [isAuthenticated, profileCompleted, userId])

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) void navigateFromNotificationData(response.notification.request.content.data as any)
    })

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      void navigateFromNotificationData(response.notification.request.content.data as any)
    })

    return () => subscription.remove()
  }, [])

  if (!isAuthenticated || !profileCompleted) return <AuthNavigator initialRouteName={initialAuthRoute} />
  return <MainNavigator />
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Fraunces-Regular':  require('./assets/fonts/Fraunces_72pt-Regular.ttf'),
    'Fraunces-SemiBold': require('./assets/fonts/Fraunces_72pt-SemiBold.ttf'),
    'Fraunces-Bold':     require('./assets/fonts/Fraunces_72pt-Bold.ttf'),
    'Inter-Regular':      Inter_400Regular,
    'Inter-Italic':       Inter_400Regular_Italic,
    'Inter-Medium':       Inter_500Medium,
    'Inter-SemiBold':     Inter_600SemiBold,
    'Inter-Bold':         Inter_700Bold,
    'Inter-ExtraBold':    Inter_800ExtraBold,
    'Inter-Black':        Inter_900Black,
  })

  const [hasOnboarded,    setHasOnboarded]    = useState<boolean | null>(null)
  const [initialAuthRoute, setInitialAuthRoute] = useState<'Welcome' | 'CountrySelect' | 'Login'>('Welcome')

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setHasOnboarded(val === 'true')
    })
  }, [])

  const appReady = fontsLoaded && hasOnboarded !== null

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync()
  }, [appReady])

  // Splash stays up until fonts and AsyncStorage are ready
  if (!appReady) return null

  async function completeOnboarding(dest?: 'CountrySelect' | 'Login') {
    if (dest) setInitialAuthRoute(dest)
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
    setHasOnboarded(true)
  }

  if (!hasOnboarded) {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <SafeAreaProvider>
            <OnboardingScreen onDone={completeOnboarding} />
          </SafeAreaProvider>
        </ThemeProvider>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <ConnectivityProvider>
            <AuthProvider>
              <NavigationContainer ref={navigationRef} linking={appLinking}>
                <RewardsProvider onOpenRewards={openRewards}>
                  <RootNavigator initialAuthRoute={initialAuthRoute} />
                </RewardsProvider>
              </NavigationContainer>
              <OfflineBanner />
            </AuthProvider>
          </ConnectivityProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
