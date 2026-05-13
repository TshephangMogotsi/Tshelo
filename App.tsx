import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AuthNavigator from './navigation/AuthNavigator'

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
