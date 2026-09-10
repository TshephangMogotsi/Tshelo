jest.mock('../../../../context/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors }) }))
jest.mock('../../../../lib/apiScreen', () => ({ toApiUiError: error => ({ message: error instanceof Error ? error.message : 'Request failed' }) }))
jest.mock('../../../../lib/api', () => ({ api: { events: { update: jest.fn() } } }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { TouchableOpacity } = require('react-native')
const EventScheduleCard = require('../EventScheduleCard').default
const { api } = require('../../../../lib/api')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const schedule = {
  eventDate: '2099-12-12', eventTime: '14:00:00', eventEndDate: '2099-12-12', eventEndTime: '18:00:00',
  timeZone: 'Africa/Gaborone', rsvpDeadline: '2099-12-10', status: 'active',
}
let tree
let onUpdated

beforeEach(() => {
  jest.clearAllMocks()
  onUpdated = jest.fn()
  api.events.update.mockResolvedValue({
    event_date: '2099-12-13', event_time: '15:00:00', event_end_date: '2099-12-13', event_end_time: '19:00:00',
    time_zone: 'Europe/London', rsvp_deadline: '2099-12-11',
  })
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
})

function control(label) {
  return tree.root.findAllByType(TouchableOpacity).find(item => item.props.accessibilityLabel === label)
}

it('saves date, time, timezone and RSVP-deadline changes through the shared event API', async () => {
  await act(async () => { tree = create(React.createElement(EventScheduleCard, { eventId: 'event-1', schedule, canManage: true, onUpdated })) })
  await act(async () => control('Edit event schedule settings').props.onPress())
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Event date' }).props.onChangeText('2099-12-13')
    tree.root.findByProps({ accessibilityLabel: 'Event start time' }).props.onChangeText('15:00')
    tree.root.findByProps({ accessibilityLabel: 'Event end date' }).props.onChangeText('2099-12-13')
    tree.root.findByProps({ accessibilityLabel: 'Event end time' }).props.onChangeText('19:00')
    tree.root.findByProps({ accessibilityLabel: 'Event time zone' }).props.onChangeText('Europe/London')
    tree.root.findByProps({ accessibilityLabel: 'RSVP deadline' }).props.onChangeText('2099-12-11')
  })
  await act(async () => control('Save schedule settings').props.onPress())
  expect(api.events.update).toHaveBeenCalledWith('event-1', {
    event_date: '2099-12-13', event_time: '15:00:00', event_end_date: '2099-12-13', event_end_time: '19:00:00',
    time_zone: 'Europe/London', rsvp_deadline: '2099-12-11',
  })
  expect(onUpdated).toHaveBeenCalledWith({
    eventDate: '2099-12-13', eventTime: '15:00:00', eventEndDate: '2099-12-13', eventEndTime: '19:00:00',
    timeZone: 'Europe/London', rsvpDeadline: '2099-12-11',
  })
})

it('rejects an RSVP deadline after the event date before calling the API', async () => {
  await act(async () => { tree = create(React.createElement(EventScheduleCard, { eventId: 'event-1', schedule, canManage: true, onUpdated })) })
  await act(async () => control('Edit event schedule settings').props.onPress())
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'RSVP deadline' }).props.onChangeText('2099-12-14'))
  await act(async () => control('Save schedule settings').props.onPress())
  expect(api.events.update).not.toHaveBeenCalled()
  expect(JSON.stringify(tree.toJSON())).toContain('cannot be after the event date')
})
