jest.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }) }))
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ userId: 'user-1', refreshProfile: mockRefreshProfile }) }))
jest.mock('../../../context/ConnectivityContext', () => ({ useRequireOnline: () => () => true }))
jest.mock('@react-navigation/native', () => {
  const React = require('react')
  return { useFocusEffect: callback => React.useEffect(callback, [callback]) }
})
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')
jest.mock('../../../lib/api', () => ({ api: { users: { me: jest.fn(), updateMe: jest.fn() } } }))

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Alert, Switch } = require('react-native')
const { api } = require('../../../lib/api')
const { DEFAULT_NOTIFICATION_PREFERENCES } = require('../../../shared/contracts/users')
const NotificationSettingsScreen = require('../NotificationSettingsScreen').default
const mockRefreshProfile = jest.fn()
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let tree
const profile = { notifications_enabled: true, notification_preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES } }
beforeEach(async () => {
  jest.clearAllMocks(); mockRefreshProfile.mockResolvedValue(undefined)
  api.users.me.mockResolvedValue(profile)
  api.users.updateMe.mockImplementation(async patch => patch)
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await act(async () => { tree = create(<NotificationSettingsScreen navigation={{ goBack: jest.fn() }} />) })
})
afterEach(async () => { await act(async () => tree.unmount()); jest.restoreAllMocks() })

it('loads the caller profile through the API and saves category preferences without a user ID in the payload', async () => {
  expect(api.users.me).toHaveBeenCalledTimes(1)
  await act(async () => tree.root.findAllByType(Switch)[1].props.onValueChange(false))
  expect(api.users.updateMe).toHaveBeenCalledWith({ notifications_enabled: true, notification_preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, fund_invites: false } })
  expect(mockRefreshProfile).toHaveBeenCalledTimes(1)
  expect(tree.root.findAllByType(Switch)[1].props.value).toBe(false)
})

it('uses the server response and disables routine categories when the master setting is off', async () => {
  await act(async () => tree.root.findAllByType(Switch)[0].props.onValueChange(false))
  expect(api.users.updateMe).toHaveBeenCalledWith({ notifications_enabled: false, notification_preferences: DEFAULT_NOTIFICATION_PREFERENCES })
  expect(tree.root.findAllByType(Switch).slice(1).every(node => node.props.disabled)).toBe(true)
})

it('restores the previous setting when the API save fails', async () => {
  api.users.updateMe.mockRejectedValueOnce(new TypeError('Network failure'))
  await act(async () => tree.root.findAllByType(Switch)[1].props.onValueChange(false))
  expect(tree.root.findAllByType(Switch)[1].props.value).toBe(true)
  expect(Alert.alert).toHaveBeenCalledWith('Could not save notification settings', expect.any(String))
  expect(mockRefreshProfile).not.toHaveBeenCalled()
})

it('blocks overlapping saves while the first request is pending', async () => {
  let resolveSave
  api.users.updateMe.mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve }))
  await act(async () => { tree.root.findAllByType(Switch)[1].props.onValueChange(false) })
  expect(tree.root.findAllByType(Switch).every(node => node.props.disabled)).toBe(true)
  await act(async () => tree.root.findAllByType(Switch)[0].props.onValueChange(false))
  expect(api.users.updateMe).toHaveBeenCalledTimes(1)
  await act(async () => resolveSave({ ...profile, notification_preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, fund_invites: false } }))
})
