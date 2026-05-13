import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthStackParamList } from './types'
import WelcomeScreen from '../screens/auth/WelcomeScreen'
import LoginScreen from '../screens/auth/LoginScreen'
import OTPScreen from '../screens/auth/OTPScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'
import RecoverScreen from '../screens/auth/RecoverScreen'

const Stack = createNativeStackNavigator<AuthStackParamList>()

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome"  component={WelcomeScreen} />
      <Stack.Screen name="Login"    component={LoginScreen} />
      <Stack.Screen name="OTP"      component={OTPScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Recover"  component={RecoverScreen} />
    </Stack.Navigator>
  )
}
