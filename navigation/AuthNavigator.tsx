import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthStackParamList } from './types'
import WelcomeScreen from '../screens/auth/WelcomeScreen'
import LoginScreen from '../screens/auth/LoginScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'
import OTPScreen from '../screens/auth/OTPScreen'
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen'
import RegistrationSuccessScreen from '../screens/auth/RegistrationSuccessScreen'
import SupportScreen from '../screens/support/SupportScreen'

const Stack = createNativeStackNavigator<AuthStackParamList>()

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome"      component={WelcomeScreen} />
      <Stack.Screen name="Login"        component={LoginScreen} />
      <Stack.Screen name="Register"     component={RegisterScreen} />
      <Stack.Screen name="OTP"          component={OTPScreen} />
      <Stack.Screen name="ProfileSetup"          component={ProfileSetupScreen} />
      <Stack.Screen name="RegistrationSuccess"   component={RegistrationSuccessScreen} />
      <Stack.Screen name="Support"               component={SupportScreen} />
    </Stack.Navigator>
  )
}
