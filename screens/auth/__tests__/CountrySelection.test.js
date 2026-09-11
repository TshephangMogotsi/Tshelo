jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('../../../context/ConnectivityContext', () => ({ useRequireOnline: () => () => true }))
jest.mock('../../../lib/legalDocuments', () => ({ openLegalDocument: jest.fn() }))
jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: jest.fn() } },
}))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Text, TextInput, TouchableOpacity } = require('react-native')
const CountrySelectScreen = require('../CountrySelectScreen').default
const LoginScreen = require('../LoginScreen').default
const RegisterScreen = require('../RegisterScreen').default
const { supabase } = require('../../../lib/supabase')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
let navigation

beforeEach(() => {
  jest.clearAllMocks()
  navigation = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() }
  supabase.auth.signInWithOtp.mockResolvedValue({ error: null })
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
  tree = null
})

function button(label) {
  return tree.root.findAllByType(TouchableOpacity).find(item => (
    item.props.accessibilityLabel === label
      || item.findAllByType(Text).some(text => text.props.children === label)
  ))
}

async function chooseUnitedStates() {
  const search = tree.root.findByProps({ accessibilityLabel: 'Search countries' })
  await act(async () => search.props.onChangeText('United States'))
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'United States, +1, USD' }).props.onPress())
}

it('lets a new member choose a country outside the featured grid', async () => {
  await act(async () => {
    tree = create(React.createElement(CountrySelectScreen, { navigation }))
  })
  await act(async () => button('Choose another country').props.onPress())
  await chooseUnitedStates()
  await act(async () => button('Continue').props.onPress())

  expect(navigation.navigate).toHaveBeenCalledWith('Register', {
    countryCode: 'US',
    countryName: 'United States',
    currency: 'USD',
    flag: '🇺🇸',
    dialCode: '+1',
  })
})

it('registers an international number with the selected calling code', async () => {
  await act(async () => {
    tree = create(React.createElement(RegisterScreen, {
      navigation,
      route: {
        params: {
          countryCode: 'US', countryName: 'United States', currency: 'USD', flag: '🇺🇸', dialCode: '+1',
        },
      },
    }))
  })

  await act(async () => tree.root.findByProps({ placeholder: 'e.g. Kefilwe Moeti' }).props.onChangeText('Taylor Smith'))
  await act(async () => tree.root.findByProps({ placeholder: 'National phone number' }).props.onChangeText('202 555 0123'))
  const consent = button('Agree to the Terms of Service and Privacy Policy')
  await act(async () => consent.props.onPress())
  await act(async () => button('Continue').props.onPress())

  expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
    phone: '+12025550123',
    options: { shouldCreateUser: true },
  })
  expect(navigation.navigate).toHaveBeenCalledWith('OTP', expect.objectContaining({
    phone: '+12025550123', mode: 'register',
  }))
})

it('lets an international member choose their calling code when signing in', async () => {
  await act(async () => {
    tree = create(React.createElement(LoginScreen, { navigation }))
  })
  await act(async () => button('Change country, currently Botswana +267').props.onPress())
  await chooseUnitedStates()
  await act(async () => tree.root.findByProps({ placeholder: 'National phone number' }).props.onChangeText('202 555 0123'))
  await act(async () => button('Send Code').props.onPress())

  expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
    phone: '+12025550123',
    options: { shouldCreateUser: false },
  })
  expect(navigation.navigate).toHaveBeenCalledWith('OTP', { phone: '+12025550123', mode: 'login' })
})
