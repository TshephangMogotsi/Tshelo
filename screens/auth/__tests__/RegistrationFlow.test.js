jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ refreshProfile: jest.fn().mockResolvedValue(undefined) }),
}))
jest.mock('../../../context/ConnectivityContext', () => ({ useRequireOnline: () => () => true }))
jest.mock('../../../lib/haptics', () => ({ hapticError: jest.fn(), hapticSuccess: jest.fn() }))
jest.mock('../../../lib/apiScreen', () => ({
  toApiUiError: error => ({ message: error instanceof Error ? error.message : 'Request failed' }),
}))
jest.mock('../../../lib/api', () => ({ api: { users: { updateMe: jest.fn() } } }))
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: jest.fn(),
      signInWithOtp: jest.fn(),
      getUser: jest.fn(),
    },
  },
}))
jest.mock('../../../components/ProviderLogo', () => 'ProviderLogo')
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Alert, Text, TextInput, TouchableOpacity } = require('react-native')
const BankDetailsScreen = require('../BankDetailsScreen').default
const OTPScreen = require('../OTPScreen').default
const ReceiveMoneyScreen = require('../ReceiveMoneyScreen').default
const RegistrationSuccessScreen = require('../RegistrationSuccessScreen').default
const { api } = require('../../../lib/api')
const { supabase } = require('../../../lib/supabase')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const navigation = { navigate: jest.fn(), goBack: jest.fn() }

function button(label) {
  return tree.root.findAllByType(TouchableOpacity).find(item => (
    item.props.accessibilityLabel === label
      || item.findAllByType(Text).some(text => text.props.children === label)
  ))
}

beforeEach(() => {
  jest.clearAllMocks()
  api.users.updateMe.mockResolvedValue({})
  supabase.auth.verifyOtp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
  tree = null
  jest.restoreAllMocks()
})

it('keeps registration incomplete after OTP and opens bank details', async () => {
  const route = {
    params: {
      phone: '+26771234567',
      mode: 'register',
      registration: {
        name: 'Kefilwe Moeti',
        provider: 'orange_money',
        bank: { bankName: '', branchCode: '', accountNumber: '', accountType: 'savings' },
      },
    },
  }
  await act(async () => { tree = create(React.createElement(OTPScreen, { navigation, route })) })
  const inputs = tree.root.findAllByType(TextInput).filter(input => input.props.maxLength === 1)
  for (const input of inputs) await act(async () => input.props.onChangeText('1'))
  await act(async () => button('Verify').props.onPress())

  const update = api.users.updateMe.mock.calls[0][0]
  expect(update).toMatchObject({
    name: 'Kefilwe Moeti',
    terms_version: '1.0',
    privacy_version: '1.0',
    data_processing_consent: true,
  })
  expect(update).not.toHaveProperty('profile_completed')
  expect(update).not.toHaveProperty('onboarding_completed')
  expect(update).not.toHaveProperty('bank_account_number')
  expect(navigation.navigate).toHaveBeenCalledWith('BankDetails', expect.objectContaining({
    name: 'Kefilwe Moeti',
    registeredPhone: '+26771234567',
  }))
})

it('persists confirmed payment details before showing registration success', async () => {
  const route = {
    params: {
      name: 'Kefilwe Moeti',
      registeredPhone: '+26771234567',
      bankName: 'First National Bank',
      accountNumber: '62012345678',
      bankAccounts: [{
        id: 'bank-1',
        bankName: 'First National Bank',
        branchCode: '282267',
        accountNumber: '62012345678',
      }],
      mobileMoneyNumbers: [],
    },
  }
  await act(async () => { tree = create(React.createElement(ReceiveMoneyScreen, { navigation, route })) })
  const confirmation = tree.root.findAllByType(TouchableOpacity).find(item => (
    item.findAllByType(Text).some(text => String(text.props.children).startsWith('I confirm'))
  ))
  await act(async () => confirmation.props.onPress())
  await act(async () => button('Confirm & Continue').props.onPress())

  expect(api.users.updateMe).toHaveBeenCalledWith({
    name: 'Kefilwe Moeti',
    mobile_money_provider: 'orange_money',
    bank_name: 'First National Bank',
    bank_branch_code: '282267',
    bank_account_number: '62012345678',
  })
  expect(navigation.navigate).toHaveBeenCalledWith('RegistrationSuccess')
})

it('confirms before removing a saved bank account', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const route = {
    params: {
      name: 'Kefilwe Moeti',
      registeredPhone: '+26771234567',
      bankAccounts: [{
        id: 'bank-1',
        bankName: 'First National Bank',
        branchCode: '282267',
        accountNumber: '62012343543',
      }],
      mobileMoneyNumbers: [],
    },
  }
  await act(async () => { tree = create(React.createElement(BankDetailsScreen, { navigation, route })) })
  await act(async () => button('Remove First National Bank account ending 3543').props.onPress())

  expect(alert).toHaveBeenCalledWith(
    'Remove bank account?',
    'First National Bank ending 3543 will be removed from this setup.',
    expect.any(Array),
  )
  const actions = alert.mock.calls[0][2]
  await act(async () => actions.find(action => action.text === 'Remove').onPress())
  expect(button('Remove First National Bank account ending 3543')).toBeUndefined()
  alert.mockRestore()
})

it('marks registration complete only when the user taps Lets Go', async () => {
  await act(async () => { tree = create(React.createElement(RegistrationSuccessScreen, { navigation })) })
  expect(api.users.updateMe).not.toHaveBeenCalled()
  await act(async () => button("Let's Go!").props.onPress())
  expect(api.users.updateMe).toHaveBeenCalledWith({
    profile_completed: true,
    onboarding_completed: true,
  })
})
