import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { MainStackParamList, MainTabParamList } from './types'
import { useTheme } from '../context/ThemeContext'

// Tab screens
import HomeScreen     from '../screens/main/HomeScreen'
import FundsScreen    from '../screens/main/FundsScreen'
import ActivityScreen from '../screens/main/ActivityScreen'
import ReportsScreen  from '../screens/main/ReportsScreen'
import ProfileScreen  from '../screens/main/ProfileScreen'

// Stack screens
import CreateFundScreen         from '../screens/main/CreateFundScreen'
import JoinFundScreen           from '../screens/main/JoinFundScreen'
import FundDetailScreen         from '../screens/main/FundDetailScreen'
import EventDetailScreen        from '../screens/main/EventDetailScreen'
import GuestListScreen          from '../screens/main/GuestListScreen'
import EventBudgetScreen        from '../screens/main/EventBudgetScreen'
import RecordContributionScreen from '../screens/main/RecordContributionScreen'
import RecordExpenseScreen      from '../screens/main/RecordExpenseScreen'
import TokenPurchaseScreen      from '../screens/main/TokenPurchaseScreen'
import SettingsScreen           from '../screens/main/SettingsScreen'
import NotificationsScreen      from '../screens/main/NotificationsScreen'
import SupportScreen            from '../screens/support/SupportScreen'
import FundCreatedScreen        from '../screens/main/FundCreatedScreen'

// ── Custom tab bar ────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const activeRoute = state.routes[state.index]?.name

  function pressTab(name: keyof MainTabParamList) {
    const route = state.routes.find(r => r.name === name)!
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (activeRoute !== name && !event.defaultPrevented) navigation.navigate(name as any)
  }

  function renderTab(name: keyof MainTabParamList, label: string, icon: keyof typeof Ionicons.glyphMap, on: keyof typeof Ionicons.glyphMap) {
    const focused = activeRoute === name
    return (
      <TouchableOpacity key={name} style={tabStyles.tab} onPress={() => pressTab(name)} activeOpacity={0.7}>
        <View style={[tabStyles.iconWrap, focused && { backgroundColor: colors.primaryLight }]}>
          <Ionicons name={focused ? on : icon} size={22} color={focused ? colors.primary : colors.textMuted} />
        </View>
        <Text style={[tabStyles.label, { color: focused ? colors.primary : colors.textMuted }, focused && tabStyles.labelActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[tabStyles.container, {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 8),
    }]}>
      {renderTab('Home',  'Home',  'home-outline',   'home'  )}
      {renderTab('Funds', 'Funds', 'wallet-outline', 'wallet')}

      {/* Create FAB */}
      <TouchableOpacity style={tabStyles.tab} onPress={() => (navigation as any).navigate('CreateFund')} activeOpacity={0.85}>
        <View style={[tabStyles.createFab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </View>
        <Text style={[tabStyles.label, { color: colors.textMuted }]}>Create</Text>
      </TouchableOpacity>

      {renderTab('Activity', 'Events', 'calendar-outline', 'calendar')}
      {renderTab('Reports', 'Reports', 'bar-chart-outline', 'bar-chart')}
    </View>
  )
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '700',
  },
  createFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
})

// ── Tab navigator ─────────────────────────────────────────────
const Tab = createBottomTabNavigator<MainTabParamList>()

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={HomeScreen}     />
      <Tab.Screen name="Funds"    component={FundsScreen}    />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Reports"  component={ReportsScreen}  />
      <Tab.Screen name="Profile"  component={ProfileScreen}  />
    </Tab.Navigator>
  )
}

// ── Root stack (tabs + modal screens) ─────────────────────────
const Stack = createNativeStackNavigator<MainStackParamList>()

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"               component={TabNavigator}            />
      <Stack.Screen name="CreateFund"         component={CreateFundScreen}        />
      <Stack.Screen name="JoinFund"           component={JoinFundScreen}          />
      <Stack.Screen name="FundDetail"         component={FundDetailScreen}        />
      <Stack.Screen name="EventDetail"        component={EventDetailScreen}       />
      <Stack.Screen name="GuestList"          component={GuestListScreen}         />
      <Stack.Screen name="EventBudget"        component={EventBudgetScreen}       />
      <Stack.Screen name="RecordContribution" component={RecordContributionScreen}/>
      <Stack.Screen name="RecordExpense"      component={RecordExpenseScreen}     />
      <Stack.Screen name="TokenPurchase"      component={TokenPurchaseScreen}     />
      <Stack.Screen name="Settings"           component={SettingsScreen}          />
      <Stack.Screen name="Notifications"      component={NotificationsScreen}     />
      <Stack.Screen name="Support"            component={SupportScreen}           />
      <Stack.Screen name="FundCreated"        component={FundCreatedScreen}       />
    </Stack.Navigator>
  )
}
