import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { MainStackParamList } from './types'
import HomeScreen from '../screens/main/HomeScreen'
import CreateFundScreen from '../screens/main/CreateFundScreen'
import JoinFundScreen from '../screens/main/JoinFundScreen'
import FundDetailScreen from '../screens/main/FundDetailScreen'
import RecordContributionScreen from '../screens/main/RecordContributionScreen'
import RecordExpenseScreen from '../screens/main/RecordExpenseScreen'
import TokenPurchaseScreen from '../screens/main/TokenPurchaseScreen'

const Stack = createNativeStackNavigator<MainStackParamList>()

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"               component={HomeScreen} />
      <Stack.Screen name="CreateFund"         component={CreateFundScreen} />
      <Stack.Screen name="JoinFund"           component={JoinFundScreen} />
      <Stack.Screen name="FundDetail"         component={FundDetailScreen} />
      <Stack.Screen name="RecordContribution" component={RecordContributionScreen} />
      <Stack.Screen name="RecordExpense"      component={RecordExpenseScreen} />
      <Stack.Screen name="TokenPurchase"      component={TokenPurchaseScreen} />
    </Stack.Navigator>
  )
}
