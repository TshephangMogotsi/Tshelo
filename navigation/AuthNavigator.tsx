import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthStackParamList } from './types'
import WelcomeScreen from '../screens/auth/WelcomeScreen'
import CountrySelectScreen from '../screens/auth/CountrySelectScreen'
import LoginScreen from '../screens/auth/LoginScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'
import OTPScreen from '../screens/auth/OTPScreen'
import BankDetailsScreen from '../screens/auth/BankDetailsScreen'
import ReceiveMoneyScreen from '../screens/auth/ReceiveMoneyScreen'
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen'
import RegistrationSuccessScreen from '../screens/auth/RegistrationSuccessScreen'
import SupportScreen from '../screens/support/SupportScreen'

const Stack = createNativeStackNavigator<AuthStackParamList>()

export default function AuthNavigator({ initialRouteName = 'Welcome' }: { initialRouteName?: keyof AuthStackParamList }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome"       component={WelcomeScreen}       />
      <Stack.Screen name="CountrySelect" component={CountrySelectScreen}  />
      <Stack.Screen name="Login"         component={LoginScreen}          />
      <Stack.Screen name="Register"     component={RegisterScreen} />
      <Stack.Screen name="OTP"         component={OTPScreen}         />
      <Stack.Screen name="BankDetails" component={BankDetailsScreen} />
      <Stack.Screen name="ReceiveMoney" component={ReceiveMoneyScreen} />
      <Stack.Screen name="ProfileSetup"          component={ProfileSetupScreen} />
      <Stack.Screen name="RegistrationSuccess"   component={RegistrationSuccessScreen} />
      <Stack.Screen name="Support"               component={SupportScreen} />
    </Stack.Navigator>
  )
}
