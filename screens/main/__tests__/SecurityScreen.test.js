jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }),
}))
const mockLoadSecuritySession = jest.fn()
const mockSignOutOtherSessions = jest.fn()

jest.mock('../../../context/ConnectivityContext', () => ({ useRequireOnline: () => () => true }))
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    loadSecuritySession: mockLoadSecuritySession,
    signOutOtherSessions: mockSignOutOtherSessions,
  }),
}))
jest.mock('@react-navigation/native', () => {
  const React = require('react')
  return { useFocusEffect: callback => React.useEffect(callback, [callback]) }
})
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Alert, Text } = require('react-native')
const SecurityScreen = require('../SecurityScreen').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const navigation = { goBack: jest.fn() }

beforeEach(() => {
  jest.clearAllMocks()
  mockLoadSecuritySession.mockResolvedValue({
    phone: '+26771000001',
    phoneConfirmedAt: '2026-09-11T08:00:00.000Z',
    lastSignInAt: '2026-09-11T08:30:00.000Z',
  })
  mockSignOutOtherSessions.mockResolvedValue(undefined)
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
  tree = null
  jest.restoreAllMocks()
})

async function renderScreen() {
  await act(async () => {
    tree = create(React.createElement(SecurityScreen, { navigation }))
    await Promise.resolve()
  })
}

function hasText(label) {
  return tree.root.findAllByType(Text).some(text => text.props.children === label)
}

it('shows the verified login number and current device session', async () => {
  await renderScreen()

  expect(hasText('Phone OTP protection')).toBe(true)
  expect(hasText('Verified')).toBe(true)
  expect(hasText('+267 71 000 001')).toBe(true)
  expect(hasText('This device')).toBe(true)
  expect(hasText('Active now')).toBe(true)
})

it('signs out every other session while preserving the current device', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await renderScreen()

  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Sign out other devices' }).props.onPress())
  expect(mockSignOutOtherSessions).not.toHaveBeenCalled()

  const confirmationActions = alert.mock.calls[0][2]
  await act(async () => {
    confirmationActions.find(action => action.text === 'Sign Out').onPress()
    await Promise.resolve()
  })

  expect(mockSignOutOtherSessions).toHaveBeenCalledTimes(1)
  expect(alert).toHaveBeenLastCalledWith(
    'Other devices signed out',
    'This device remains signed in. Other devices may take a short time to lose access.',
  )
  expect(hasText('Active now')).toBe(true)
})

it('recovers when signing out other devices fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockSignOutOtherSessions.mockRejectedValueOnce(new Error('Network unavailable'))
  await renderScreen()

  const button = tree.root.findByProps({ accessibilityLabel: 'Sign out other devices' })
  await act(async () => button.props.onPress())
  const confirmationActions = alert.mock.calls[0][2]
  await act(async () => {
    confirmationActions.find(action => action.text === 'Sign Out').onPress()
    await Promise.resolve()
  })

  expect(alert).toHaveBeenLastCalledWith('Could not sign out other devices', 'Please try again.')
  expect(tree.root.findByProps({ accessibilityLabel: 'Sign out other devices' }).props.disabled).toBe(false)
})
