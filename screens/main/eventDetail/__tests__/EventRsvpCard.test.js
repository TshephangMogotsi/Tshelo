jest.mock('../../../../context/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors }) }))
jest.mock('../../../../lib/apiScreen', () => ({
  runApiRead: callback => callback({}),
  toApiUiError: error => ({ message: error instanceof Error ? error.message : 'Request failed' }),
}))
jest.mock('../../../../lib/api', () => ({ api: { events: { myRsvp: jest.fn(), respondRsvp: jest.fn() } } }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Text, TextInput, TouchableOpacity } = require('react-native')
const EventRsvpCard = require('../EventRsvpCard').default
const { api } = require('../../../../lib/api')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const guest = {
  id: 'guest-1', event_id: 'event-1', user_id: 'user-1', guest_name: 'Kago', guest_phone: '+26770000000', guest_email: null,
  rsvp_status: 'yes', rsvp_responded_at: null, plus_ones: 0, allowed_plus_ones: 2, plus_ones_names: [], rsvp_note: null,
  dietary_requirements: null, accessibility_needs: null, invited_by: null, invited_at: '2026-09-01T00:00:00Z',
  invitation_sent_at: null, invitation_channel: 'link', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
}
const schedule = {
  eventDate: '2099-12-12', eventTime: '14:00:00', eventEndDate: null, eventEndTime: null,
  timeZone: 'Africa/Gaborone', rsvpDeadline: '2099-12-10', status: 'active',
}
let tree
let onSaved

beforeEach(() => {
  jest.clearAllMocks()
  onSaved = jest.fn()
  api.events.myRsvp.mockResolvedValue(guest)
  api.events.respondRsvp.mockResolvedValue({ ...guest, rsvp_status: 'maybe', plus_ones: 1, plus_ones_names: ['Neo'] })
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
})

function button(label) {
  return tree.root.findAllByType(TouchableOpacity).find(item => (
    item.props.accessibilityLabel === label
      || item.findAllByType(Text).some(text => text.props.children === label)
  ))
}

it('shows the personal allowance and saves an updated attendee RSVP', async () => {
  await act(async () => { tree = create(React.createElement(EventRsvpCard, { eventId: 'event-1', schedule, onSaved })) })
  expect(JSON.stringify(tree.toJSON())).toContain('up to 2 additional guests')
  await act(async () => button('Maybe RSVP').props.onPress())
  await act(async () => button('Add one additional guest').props.onPress())
  const name = tree.root.findByProps({ accessibilityLabel: 'Additional guest 1 name' })
  expect(name.type).toBe(TextInput)
  await act(async () => name.props.onChangeText('Neo'))
  await act(async () => button('Save RSVP').props.onPress())
  expect(api.events.respondRsvp).toHaveBeenCalledWith('event-1', expect.objectContaining({
    status: 'maybe', plus_ones: 1, plus_ones_names: ['Neo'],
  }))
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ rsvp_status: 'maybe' }))
})

it('keeps RSVP controls read-only after the event deadline', async () => {
  await act(async () => { tree = create(React.createElement(EventRsvpCard, {
    eventId: 'event-1', schedule: { ...schedule, eventDate: '2026-09-01', rsvpDeadline: '2026-08-31' }, onSaved,
  })) })
  expect(button('Save RSVP').props.disabled).toBe(true)
  expect(JSON.stringify(tree.toJSON())).toContain('Responses closed')
})
