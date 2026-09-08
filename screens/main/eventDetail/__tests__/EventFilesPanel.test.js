jest.mock('../../../../lib/api', () => ({ api: { events: { createFileAccess: jest.fn() } } }))
jest.mock('../../../../context/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors }) }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Image, TouchableOpacity } = require('react-native')
const EventFilesPanel = require('../EventFilesPanel').default
const { api } = require('../../../../lib/api')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const pdf = { id: 'pdf-1', event_id: 'event-1', object_path: 'event-1/pdf', file_name: 'Programme.pdf', content_type: 'application/pdf', size_bytes: 100 }
const photo = { ...pdf, id: 'image-1', object_path: 'event-1/image', file_name: 'Venue.jpg', content_type: 'image/jpeg' }
let tree
let props

beforeEach(() => {
  jest.clearAllMocks()
  api.events.createFileAccess.mockResolvedValue({ download_url: 'https://storage.test/private-image' })
  props = {
    eventId: 'event-1', canManage: true, inactive: false, actionPath: null,
    onPreview: jest.fn(), onDownload: jest.fn(),
    manager: { files: [], uploads: [], removals: [], busy: false, error: null, addFiles: jest.fn(), confirmRemove: jest.fn(), retryUpload: jest.fn(), dismissUpload: jest.fn(), retryRemove: jest.fn() },
  }
})
afterEach(async () => { if (tree) await act(async () => tree.unmount()) })
async function render() { await act(async () => { tree = create(React.createElement(EventFilesPanel, props)) }) }
const buttons = () => tree.root.findAllByType(TouchableOpacity)
const button = label => buttons().find(item => item.props.accessibilityLabel === label)
const text = () => JSON.stringify(tree.toJSON())

it('shows the empty state and organiser Add files action', async () => {
  await render()
  expect(text()).toContain('No event files yet')
  button('Add files').props.onPress()
  expect(props.manager.addFiles).toHaveBeenCalled()
})

it.each([false, true])('keeps files readable without edit controls (inactive=%s)', async inactive => {
  props.canManage = false
  props.inactive = inactive
  props.manager.files = [pdf]
  await render()
  expect(button('Add files')).toBeUndefined()
  expect(button('Delete Programme.pdf')).toBeUndefined()
  expect(text()).toContain(inactive ? 'This event is read-only' : 'Only organisers')
  button('Download or share Programme.pdf').props.onPress()
  expect(props.onDownload).toHaveBeenCalledWith(pdf)
})

it('renders a signed image gallery and separate PDF rows, wired to the shared viewer', async () => {
  props.manager.files = [photo, pdf]
  await render()
  expect(tree.root.findByType(Image).props.source.uri).toBe('https://storage.test/private-image')
  expect(api.events.createFileAccess).toHaveBeenCalledTimes(1)
  button('Preview Venue.jpg').props.onPress()
  expect(props.onPreview).toHaveBeenCalledWith([photo], photo)
  button('Preview Programme.pdf').props.onPress()
  expect(props.onPreview).toHaveBeenCalledWith([pdf], pdf)
  button('Delete Programme.pdf').props.onPress()
  expect(props.manager.confirmRemove).toHaveBeenCalledWith(pdf)
})

it('offers an explicit retry when the image fails to load', async () => {
  props.manager.files = [photo]
  await render()
  await act(async () => tree.root.findByType(Image).props.onError())
  expect(text()).toContain('Preview unavailable')
  await act(async () => button('Retry thumbnail for Venue.jpg').props.onPress())
  expect(api.events.createFileAccess).toHaveBeenCalledTimes(2)
})

it('shows upload progress, failures and recovery controls without allowing duplicate adds', async () => {
  props.manager.busy = true
  props.manager.uploads = [{ key: 'a', input: { file_name: 'Venue.jpg' }, status: 'working', step: 'upload', progress: 42 }]
  await render()
  expect(text()).toContain('Uploading… 42%')
  expect(button('Add files').props.disabled).toBe(true)
  props.manager.busy = false
  props.manager.uploads = [{ key: 'a', input: { file_name: 'Venue.jpg' }, status: 'failed', step: 'finalize', uploadId: 'pending', error: 'Connection lost' }]
  await act(async () => tree.update(React.createElement(EventFilesPanel, props)))
  expect(text()).toContain('Check upload')
  expect(text()).toContain('Connection lost')
  expect(button('Dismiss failed upload Venue.jpg')).toBeUndefined()
})

it('allows cleanup/deletion recovery after event completion, but no new uploads', async () => {
  props.canManage = false
  props.inactive = true
  props.manager.uploads = [{ key: 'a', input: { file_name: 'Venue.jpg' }, status: 'failed', step: 'cleanup', uploadId: 'pending', error: 'Cleanup pending' }]
  props.manager.removals = [{ file: pdf, error: 'Offline' }]
  await render()
  expect(text()).toContain('Retry cleanup')
  button('Retry deleting Programme.pdf').props.onPress()
  expect(props.manager.retryRemove).toHaveBeenCalledWith(pdf)
  expect(button('Add files')).toBeUndefined()
})

it('disables Add files at the event limit', async () => {
  props.manager.files = Array.from({ length: 10 }, (_, i) => ({ ...pdf, id: `pdf-${i}` }))
  await render()
  expect(button('Add files').props.disabled).toBe(true)
  expect(text()).toContain('File limit reached')
})
