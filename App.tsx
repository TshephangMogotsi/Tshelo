import { useEffect, useState } from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ConnectivityProvider } from './context/ConnectivityContext'
import OfflineBanner from './components/OfflineBanner'
import ErrorBoundary from './components/ErrorBoundary'
import AuthNavigator from './navigation/AuthNavigator'
import MainNavigator from './navigation/MainNavigator'
import OnboardingScreen from './screens/onboarding/OnboardingScreen'
import { registerForPushNotificationsAsync } from './lib/pushNotifications'
import { startSmsWatcher } from './lib/smsWatcher'
import type { MainStackParamList } from './navigation/types'

const ONBOARDING_KEY = 'tshelo_onboarded_v1'

// Keep the native splash visible until fonts + onboarding state are ready
SplashScreen.preventAutoHideAsync()
SplashScreen.setOptions({ fade: true, duration: 300 })

export const navigationRef = createNavigationContainerRef<MainStackParamList>()

function navigateFromNotificationData(data: Record<string, any> | undefined) {
  if (!navigationRef.isReady()) return
  const detected = data?.detectedSms
  if (detected && typeof detected.amount === 'number' && typeof detected.smsBody === 'string') {
    navigationRef.navigate('AssignContribution', { detected })
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
      if (response) navigateFromNotificationData(response.notification.request.content.data as any)
    })

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      navigateFromNotificationData(response.notification.request.content.data as any)
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

  const linking = {
    prefixes: ['tshelo://'],
    config: {
      screens: {
        JoinFund: 'join/:code',
      },
    },
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <ConnectivityProvider>
            <AuthProvider>
              <NavigationContainer ref={navigationRef} linking={linking}>
                <RootNavigator initialAuthRoute={initialAuthRoute} />
              </NavigationContainer>
              <OfflineBanner />
            </AuthProvider>
          </ConnectivityProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
