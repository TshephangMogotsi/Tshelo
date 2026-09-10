jest.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }) }))
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ userId: 'user-1' }) }))
jest.mock('../../../context/ConnectivityContext', () => ({ useRequireOnline: () => () => true }))
jest.mock('../../../lib/useHardwareBack', () => ({ useHardwareBack: jest.fn() }))
jest.mock('../../../lib/haptics', () => ({ hapticError: jest.fn(), hapticSuccess: jest.fn() }))
jest.mock('../../../lib/apiScreen', () => ({
  runApiRead: callback => callback({}),
  toApiUiError: error => ({ message: error instanceof Error ? error.message : 'Request failed' }),
}))
jest.mock('../../../lib/api', () => ({ api: { events: { previewInvite: jest.fn(), respondRsvp: jest.fn() } } }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Text, TextInput, TouchableOpacity } = require('react-native')
const JoinEventScreen = require('../JoinEventScreen').default
const { api } = require('../../../lib/api')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const navigation = { goBack: jest.fn(), replace: jest.fn() }
const route = { params: undefined }

function button(label) {
  return tree.root.findAllByType(TouchableOpacity).find(item => (
    item.findAllByType(Text).some(text => text.props.children === label)
  ))
}

beforeEach(() => {
  jest.clearAllMocks()
  api.events.previewInvite.mockResolvedValue({
    id: 'event-1',
    name: 'Kago and Neo',
    event_type: 'wedding',
    event_emoji: '💍',
    event_date: '2026-12-12',
    event_time: '14:00:00',
    venue_name: 'Gaborone',
    status: 'active',
    organiser_name: 'Kago',
    has_linked_fund: false,
    already_joined: false,
    allowed_plus_ones: 2,
  })
  api.events.respondRsvp.mockResolvedValue({ id: 'guest-1' })
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
})

it('collects RSVP and personal plus-ones before opening an invitation', async () => {
  await act(async () => { tree = create(React.createElement(JoinEventScreen, { navigation, route })) })
  const codeInput = tree.root.findByProps({ accessibilityLabel: 'Event invite code' })
  await act(async () => codeInput.props.onChangeText('EVT-12345678'))
  await act(async () => button('Find Event').props.onPress())

  expect(JSON.stringify(tree.toJSON())).toContain('up to 2 additional guests')
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Yes RSVP' }).props.onPress())
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Add one additional guest' }).props.onPress())
  const guestName = tree.root.findByProps({ accessibilityLabel: 'Additional guest 1 name' })
  expect(guestName.type).toBe(TextInput)
  await act(async () => guestName.props.onChangeText('Neo'))
  await act(async () => button('Save RSVP and Open Event').props.onPress())

  expect(api.events.respondRsvp).toHaveBeenCalledWith('event-1', {
    code: 'EVT-12345678',
    status: 'yes',
    plus_ones: 1,
    plus_ones_names: ['Neo'],
  })
  expect(navigation.replace).toHaveBeenCalledWith('EventDetail', { eventId: 'event-1' })
})

it('submits a decline with no additional guests', async () => {
  await act(async () => { tree = create(React.createElement(JoinEventScreen, { navigation, route })) })
  const codeInput = tree.root.findByProps({ accessibilityLabel: 'Event invite code' })
  await act(async () => codeInput.props.onChangeText('EVT-12345678'))
  await act(async () => button('Find Event').props.onPress())
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'No RSVP' }).props.onPress())
  await act(async () => button('Save RSVP and Open Event').props.onPress())
  expect(api.events.respondRsvp).toHaveBeenCalledWith('event-1', expect.objectContaining({
    status: 'no', plus_ones: 0, plus_ones_names: [],
  }))
})
