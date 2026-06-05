import { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AuthNavigator from './navigation/AuthNavigator'
import MainNavigator from './navigation/MainNavigator'
import OnboardingScreen from './screens/onboarding/OnboardingScreen'

const ONBOARDING_KEY = 'tshelo_onboarded_v1'

function RootNavigator({ initialAuthRoute }: { initialAuthRoute: 'Welcome' | 'CountrySelect' | 'Login' }) {
  const { isAuthenticated, profileCompleted } = useAuth()
  if (!isAuthenticated || !profileCompleted) return <AuthNavigator initialRouteName={initialAuthRoute} />
  return <MainNavigator />
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Fraunces-Regular':  require('./assets/fonts/Fraunces_72pt-Regular.ttf'),
    'Fraunces-SemiBold': require('./assets/fonts/Fraunces_72pt-SemiBold.ttf'),
    'Fraunces-Bold':     require('./assets/fonts/Fraunces_72pt-Bold.ttf'),
  })

  // DEV: always show onboarding — remove __DEV__ check before release
  const [hasOnboarded,    setHasOnboarded]    = useState<boolean | null>(__DEV__ ? false : null)
  const [initialAuthRoute, setInitialAuthRoute] = useState<'Welcome' | 'CountrySelect' | 'Login'>('Welcome')

  useEffect(() => {
    if (__DEV__) return
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setHasOnboarded(val === 'true')
    })
  }, [])

  // Wait for both fonts and AsyncStorage
  if (!fontsLoaded || hasOnboarded === null) return null

  async function completeOnboarding(dest?: 'CountrySelect' | 'Login') {
    if (dest) setInitialAuthRoute(dest)
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
    setHasOnboarded(true)
  }

  if (!hasOnboarded) {
    return (
      <ThemeProvider>
        <SafeAreaProvider>
          <OnboardingScreen onDone={completeOnboarding} />
        </SafeAreaProvider>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator initialAuthRoute={initialAuthRoute} />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  )
}
