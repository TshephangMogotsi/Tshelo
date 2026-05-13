import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AuthNavigator from './navigation/AuthNavigator'
import MainNavigator from './navigation/MainNavigator'

// Switch to MainNavigator to preview main screens, AuthNavigator for auth flow
const PREVIEW_MAIN = true

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {PREVIEW_MAIN ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
