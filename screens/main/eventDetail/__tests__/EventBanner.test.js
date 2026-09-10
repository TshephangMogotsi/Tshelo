jest.mock('../../../../context/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors }) }))
jest.mock('../../../../lib/apiScreen', () => ({
  runApiRead: callback => callback({}),
  toApiUiError: error => ({ message: error instanceof Error ? error.message : 'Request failed' }),
}))
jest.mock('../../../../lib/api', () => ({ api: { events: { createFileAccess: jest.fn() } } }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Image, TouchableOpacity } = require('react-native')
const EventBanner = require('../EventBanner').default
const { api } = require('../../../../lib/api')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const imageFile = {
  id: 'image-1', event_id: 'event-1', uploaded_by: 'user-1', file_name: 'Venue.jpg', object_path: 'event-1/image',
  content_type: 'image/jpeg', size_bytes: 100, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
}
let tree
let manager

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Image, 'getSize').mockImplementation((_url, success) => success(800, 400))
  api.events.createFileAccess.mockResolvedValue({
    download_url: 'https://storage.test/original',
    banner_thumbnail_url: 'https://storage.test/banner-preview',
  })
  manager = {
    files: [imageFile], uploads: [], removals: [], busy: false, error: null,
    addFiles: jest.fn(), addBannerImage: jest.fn(), updateBanner: jest.fn().mockResolvedValue({ file_id: imageFile.id, focal_x: 0.5, focal_y: 0.5 }),
    retryUpload: jest.fn(), dismissUpload: jest.fn(), confirmRemove: jest.fn(), retryRemove: jest.fn(), replaceFiles: jest.fn(),
  }
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
  jest.restoreAllMocks()
})

function control(label) {
  return tree.root.findAllByType(TouchableOpacity).find(item => item.props.accessibilityLabel === label)
}

it('lets a manager select an existing private image and save its focal point', async () => {
  await act(async () => { tree = create(React.createElement(EventBanner, {
    eventId: 'event-1', manager, canManage: true, inactive: false, onViewFull: jest.fn(),
  })) })
  await act(async () => control('Choose event banner').props.onPress())
  await act(async () => control('Use Venue.jpg as banner').props.onPress())
  expect(api.events.createFileAccess).toHaveBeenCalledWith('event-1', imageFile.id)
  await act(async () => control('Save event banner').props.onPress())
  expect(manager.updateBanner).toHaveBeenCalledWith(imageFile.id, 0.5, 0.5)
})

it('keeps an existing banner readable but not editable on an inactive event', async () => {
  manager.files = [{ ...imageFile, is_banner: true, banner_focal_x: 0.25, banner_focal_y: 0.75 }]
  await act(async () => { tree = create(React.createElement(EventBanner, {
    eventId: 'event-1', manager, canManage: false, inactive: true, onViewFull: jest.fn(),
  })) })
  expect(JSON.stringify(tree.toJSON())).toContain('banner is read-only')
  expect(control('Change event banner')).toBeUndefined()
  expect(control('View full banner image')).toBeDefined()
})

it('renders nothing for a viewer when no banner exists', async () => {
  manager.files = []
  await act(async () => { tree = create(React.createElement(EventBanner, {
    eventId: 'event-1', manager, canManage: false, inactive: false, onViewFull: jest.fn(),
  })) })
  expect(tree.toJSON()).toBeNull()
  expect(api.events.createFileAccess).not.toHaveBeenCalled()
})
