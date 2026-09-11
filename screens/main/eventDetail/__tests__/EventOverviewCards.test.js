jest.mock('../../../../lib/api', () => ({ api: { events: { createFileAccess: jest.fn() } } }))
jest.mock('../../../../context/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors }) }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Image, TouchableOpacity } = require('react-native')
const EventOverviewCards = require('../EventOverviewCards').default
const { api } = require('../../../../lib/api')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const image = index => ({
  id: `image-${index}`,
  event_id: 'event-1',
  uploaded_by: 'user-1',
  object_path: `event-1/image-${index}`,
  file_name: `Photo ${index}.jpg`,
  content_type: 'image/jpeg',
  size_bytes: 100,
  is_banner: index === 0,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
})

let tree
let props

beforeEach(() => {
  jest.clearAllMocks()
  api.events.createFileAccess.mockImplementation((_eventId, fileId) => Promise.resolve({
    download_url: `https://storage.test/original-${fileId}`,
    thumbnail_url: `https://storage.test/thumbnail-${fileId}`,
  }))
  props = {
    eventId: 'event-1',
    latestAnnouncement: {
      title: 'Venue moved', body: 'Use the north gate.', isPinned: true,
      authorName: 'Ayanda', createdAt: '2026-09-10T12:00:00Z', attachmentCount: 1,
    },
    plannedBudget: 'P 25,000', hasBudget: true,
    linkedFund: { raised: 'P 10,000', available: 'P 7,000' },
    canOpenBudget: true,
    attendance: { confirmedPeople: 8, pendingInvitations: 2, invitedPeople: 12 },
    guests: [
      { id: 'guest-1', name: 'Neo Kgosietsile', status: 'confirmed' },
      { id: 'guest-2', name: 'Lorato Molefe', status: 'pending' },
    ],
    venue: 'Kgale View', venueAddress: 'Plot 1, Gaborone', hasVenue: true,
    files: Array.from({ length: 6 }, (_, index) => image(index)),
    previewBusy: false,
    onOpenUpdates: jest.fn(), onOpenBudget: jest.fn(), onOpenGuests: jest.fn(),
    onOpenLocation: jest.fn(), onOpenFiles: jest.fn(), onPreview: jest.fn(),
  }
})

afterEach(async () => { if (tree) await act(async () => tree.unmount()) })

async function render() {
  await act(async () => { tree = create(React.createElement(EventOverviewCards, props)) })
}

const buttons = () => tree.root.findAllByType(TouchableOpacity)
const button = label => buttons().find(item => item.props.accessibilityLabel === label)
const text = () => JSON.stringify(tree.toJSON())

it('renders the phone-first hierarchy and its role-safe actions', async () => {
  await render()
  const output = text()
  expect(output.indexOf('Pinned update')).toBeLessThan(output.indexOf('Budget snapshot'))
  expect(output.indexOf('Budget snapshot')).toBeLessThan(output.indexOf('Attendance'))
  expect(output.indexOf('Attendance')).toBeLessThan(output.indexOf('Location'))
  expect(output.indexOf('Location')).toBeLessThan(output.indexOf('Gallery'))
  expect(output).toContain('NK')
  expect(output).not.toContain('LM')

  button('View all: Pinned update').props.onPress()
  button('Open budget: Budget snapshot').props.onPress()
  button('Guest list: Attendance').props.onPress()
  button('Open map: Location').props.onPress()
  button('View all: Gallery').props.onPress()
  expect(props.onOpenUpdates).toHaveBeenCalled()
  expect(props.onOpenBudget).toHaveBeenCalled()
  expect(props.onOpenGuests).toHaveBeenCalled()
  expect(props.onOpenLocation).toHaveBeenCalled()
  expect(props.onOpenFiles).toHaveBeenCalled()
})

it('loads only four signed low-data images and opens them in the shared viewer', async () => {
  await render()
  expect(api.events.createFileAccess).toHaveBeenCalledTimes(4)
  expect(tree.root.findAllByType(Image)).toHaveLength(4)
  const firstShown = props.files[1]
  button(`Preview ${firstShown.file_name}`).props.onPress()
  expect(props.onPreview).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ id: firstShown.id })]),
    firstShown,
  )
})

it('never falls back to the private original when a thumbnail is unavailable', async () => {
  api.events.createFileAccess.mockResolvedValue({ download_url: 'https://storage.test/private-original' })
  props.files = [image(1)]
  await render()
  expect(tree.root.findAllByType(Image)).toHaveLength(0)
  expect(text()).toContain('Tap to retry')
  await act(async () => button('Retry low-data preview for Photo 1.jpg').props.onPress())
  expect(api.events.createFileAccess).toHaveBeenCalledTimes(2)
})

it('shows clear empty and read-only budget states without an edit action', async () => {
  props.latestAnnouncement = null
  props.hasBudget = false
  props.plannedBudget = 'Not set'
  props.linkedFund = undefined
  props.canOpenBudget = false
  props.hasVenue = false
  props.venue = 'Venue to be confirmed'
  props.venueAddress = null
  props.guests = []
  props.attendance = { confirmedPeople: 0, pendingInvitations: 0, invitedPeople: 0 }
  props.files = []
  await render()
  expect(text()).toContain('No updates yet')
  expect(text()).toContain('No event budget set')
  expect(text()).toContain('Confirmed guests will appear here')
  expect(text()).toContain('The organiser has not added an address yet')
  expect(text()).toContain('No images yet')
  expect(button('Open budget: Budget snapshot')).toBeUndefined()
  expect(button('Open map: Location')).toBeUndefined()
})
