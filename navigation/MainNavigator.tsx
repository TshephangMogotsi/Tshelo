import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { MainStackParamList, MainTabParamList } from './types'
import { colors } from '../theme/colors'

// Screens
import HomeScreen               from '../screens/main/HomeScreen'
import SettingsScreen           from '../screens/main/SettingsScreen'
import CreateFundScreen         from '../screens/main/CreateFundScreen'
import JoinFundScreen           from '../screens/main/JoinFundScreen'
import FundDetailScreen         from '../screens/main/FundDetailScreen'
import RecordContributionScreen from '../screens/main/RecordContributionScreen'
import RecordExpenseScreen      from '../screens/main/RecordExpenseScreen'
import TokenPurchaseScreen      from '../screens/main/TokenPurchaseScreen'
import SupportScreen           from '../screens/support/SupportScreen'

// ── Tab config ────────────────────────────────────────────────
type TabConfig = {
  name: keyof MainTabParamList
  label: string
  icon: keyof typeof Ionicons.glyphMap
  iconActive: keyof typeof Ionicons.glyphMap
}

const TABS: TabConfig[] = [
  { name: 'Home',     label: 'Home',     icon: 'home-outline',     iconActive: 'home'     },
  { name: 'Settings', label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
]

// ── Custom tab bar ────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={tabStyles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]
        const isFocused = state.index === index
        const tab = TABS.find(t => t.name === route.name)!

        function onPress() {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={tabStyles.tab}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            <View style={[tabStyles.iconWrap, isFocused && tabStyles.iconWrapActive]}>
              <Ionicons
                name={isFocused ? tab.iconActive : tab.icon}
                size={22}
                color={isFocused ? colors.primary : colors.textMuted}
              />
            </View>
            <Text style={[tabStyles.label, isFocused && tabStyles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 10,
    paddingHorizontal: 16,
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
  iconWrapActive: {
    backgroundColor: colors.primaryLight,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
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
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

// ── Root stack (tabs + modal screens) ─────────────────────────
const Stack = createNativeStackNavigator<MainStackParamList>()

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"                component={TabNavigator} />
      <Stack.Screen name="CreateFund"          component={CreateFundScreen} />
      <Stack.Screen name="JoinFund"            component={JoinFundScreen} />
      <Stack.Screen name="FundDetail"          component={FundDetailScreen} />
      <Stack.Screen name="RecordContribution"  component={RecordContributionScreen} />
      <Stack.Screen name="RecordExpense"       component={RecordExpenseScreen} />
      <Stack.Screen name="TokenPurchase"       component={TokenPurchaseScreen} />
      <Stack.Screen name="Support"             component={SupportScreen} />
    </Stack.Navigator>
  )
}
