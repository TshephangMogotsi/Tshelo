jest.mock('@/lib/api-client', () => ({ createApiClient: () => ({ events: mockEvents }) }))
jest.mock('@/lib/home-summary-cache', () => ({ invalidateHomeSummary: jest.fn() }))
jest.mock('@/components/account-events/event-guests', () => ({ EventGuests: () => <p>Guest list</p> }))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/account/events/event-1',
  useSearchParams: () => new URLSearchParams(mockSearch),
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, ...props }) => <a {...props}>{children}</a> }))
jest.mock('next/image', () => ({ __esModule: true, default: ({ unoptimized: _unoptimized, ...props }) => <img {...props} /> }))

const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { EventWorkspaceView } = require('@/components/account-events/event-workspace')
const { EventAttachments } = require('@/components/account-events/event-attachments')
const { useEventFiles, transferEventFile } = require('@/components/account-events/use-event-files')
const { TsheloApiError } = require('@shared/api-client')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mockEvents = { workspace: jest.fn(), createFileAccess: jest.fn(), createAnnouncementAttachmentAccess: jest.fn(), createFileUploadSession: jest.fn(), finalizeFile: jest.fn(), removeFile: jest.fn() }
const mockReplace = jest.fn()
let mockSearch = 'tab=files'
const pdf = { id: 'pdf-1', event_id: 'event-1', uploaded_by: 'user-1', object_path: 'event-1/pdf', file_name: 'Programme.pdf', content_type: 'application/pdf', size_bytes: 100, created_at: '2026-09-08T12:00:00Z', updated_at: '2026-09-08T12:00:00Z' }
const photo = { ...pdf, id: 'image-1', object_path: 'event-1/image', file_name: 'Venue.jpg', content_type: 'image/jpeg' }
const workspace = { event: { id: 'event-1', name: 'Garden party', status: 'active', linked_fund_id: null }, capabilities: { is_creator: true, is_organiser: false, linked_fund_permissions: [] }, files: [photo, pdf], announcements: [], guests: [], linked_fund: null }
let root
let container
let xhr
let manager
let originalXhr
function Harness({ canManage = true }) { manager = useEventFiles('event-1', canManage); return null }
const button = name => [...document.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === name || node.textContent.trim() === name)
const text = () => document.body.textContent
async function render(element = <EventWorkspaceView eventId="event-1" />) { await act(async () => { root.render(element) }) }
async function click(name) { const node = button(name); expect(node).toBeDefined(); await act(async () => { node.click() }) }
const session = { ...pdf, upload_id: pdf.id, upload_url: 'https://storage.test/upload', expires_at: '2099-09-08T13:00:00Z' }

beforeEach(() => {
  jest.clearAllMocks()
  mockSearch = 'tab=files'
  mockEvents.workspace.mockResolvedValue(workspace)
  mockEvents.createFileAccess.mockImplementation(async (_event, id) => ({ download_url: `https://storage.test/${id}` }))
  mockEvents.createAnnouncementAttachmentAccess.mockResolvedValue({ download_url: 'https://storage.test/announcement' })
  mockEvents.createFileUploadSession.mockResolvedValue(session)
  mockEvents.finalizeFile.mockResolvedValue(pdf)
  mockEvents.removeFile.mockResolvedValue({ file_id: pdf.id })
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  originalXhr = global.XMLHttpRequest
  global.XMLHttpRequest = jest.fn(() => {
    xhr = { open: jest.fn(), setRequestHeader: jest.fn(), upload: {}, status: 200, send: jest.fn(() => { xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 }); xhr.onload() }) }
    return xhr
  })
  jest.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); global.XMLHttpRequest = originalXhr; jest.restoreAllMocks() })

it('opens the deep-linked Files tab with image gallery, PDF rows and organiser controls', async () => {
  await render()
  expect(button('Files').getAttribute('aria-selected')).toBe('true')
  expect(document.querySelector('[aria-label="Event images"] img').getAttribute('src')).toBe('https://storage.test/image-1')
  expect(document.querySelector('[aria-label="Event documents"]').textContent).toContain('Programme.pdf')
  expect(button('Add files')).toBeDefined()
  expect(button('Delete Programme.pdf')).toBeDefined()
})

it.each([
  ['guest', { ...workspace, capabilities: { ...workspace.capabilities, is_creator: false } }],
  ['completed event', { ...workspace, event: { ...workspace.event, status: 'completed' } }],
])('keeps files readable without mutation controls for a %s', async (_name, value) => {
  mockEvents.workspace.mockResolvedValue(value)
  await render()
  expect(button('Add files')).toBeUndefined()
  expect(button('Delete Programme.pdf')).toBeUndefined()
  await click('Preview Programme.pdf')
  expect(document.querySelector('iframe').getAttribute('src')).toBe('https://storage.test/pdf-1')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
})

it('honours the stable delegated file-management permission', async () => {
  mockEvents.workspace.mockResolvedValue({ ...workspace, capabilities: { ...workspace.capabilities, is_creator: false, linked_fund_permissions: ['post_event_announcements'] } })
  await render()
  expect(button('Add files')).toBeDefined()
})

it('offers the empty state and disables Add at the shared ten-file limit', async () => {
  mockEvents.workspace.mockResolvedValue({ ...workspace, files: [] })
  await render()
  expect(text()).toContain('No event files yet')
  await act(async () => root.unmount()); root = createRoot(container)
  mockEvents.workspace.mockResolvedValue({ ...workspace, files: Array.from({ length: 10 }, (_, i) => ({ ...pdf, id: `file-${i}`, object_path: `event-1/${i}` })) })
  await render()
  expect(button('Add files').disabled).toBe(true)
})

it('uses the same viewer for announcements, retains zoom and refreshes access between images', async () => {
  const second = { ...photo, id: 'image-2', object_path: 'event-1/image2', file_name: 'Map.jpg' }
  await render(<EventAttachments eventId="event-1" attachments={[photo, second]} />)
  await click('Preview Venue.jpg')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  await click('Zoom in')
  expect(document.querySelector('img[alt="Preview of Venue.jpg"]').style.transform).toBe('scale(1.25)')
  const accessCalls = mockEvents.createFileAccess.mock.calls.length
  await click('Next attachment')
  expect(mockEvents.createFileAccess).toHaveBeenCalledTimes(accessCalls + 1)
  expect(mockEvents.createFileAccess).toHaveBeenLastCalledWith('event-1', 'image-2', expect.any(Object))
  expect(document.querySelector('img[alt="Preview of Map.jpg"]').style.transform).toBe('scale(1)')
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  const { id: _id, ...announcementAttachment } = photo
  await render(<EventAttachments eventId="event-1" attachments={[announcementAttachment]} />)
  await click('Preview Venue.jpg')
  expect(mockEvents.createAnnouncementAttachmentAccess).toHaveBeenCalledWith('event-1', { object_path: photo.object_path }, expect.any(Object))
})

it('preserves the Blob download interaction and revokes the temporary object URL', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['pdf']) })
  URL.createObjectURL = jest.fn().mockReturnValue('blob:download')
  URL.revokeObjectURL = jest.fn()
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  await render()
  await click('Download Programme.pdf')
  expect(global.fetch).toHaveBeenCalledWith('https://storage.test/pdf-1')
  expect(anchorClick).toHaveBeenCalledTimes(1)
  expect(anchorClick.mock.instances[0].download).toBe('Programme.pdf')
  await new Promise(resolve => setTimeout(resolve, 5))
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:download')
  expect(document.querySelector('a[download]')).toBeNull()
})

it('shows thumbnail failure and retries without blocking other files', async () => {
  await render()
  const image = document.querySelector('[aria-label="Event images"] img')
  await act(async () => image.dispatchEvent(new Event('error')))
  expect(text()).toContain('Preview unavailable')
  await click('Retry thumbnail for Venue.jpg')
  expect(mockEvents.createFileAccess).toHaveBeenCalledTimes(2)
  expect(button('Preview Programme.pdf')).toBeDefined()
})

it('confirms deletion and does nothing when cancelled', async () => {
  await render()
  window.confirm.mockReturnValueOnce(false)
  await click('Delete Programme.pdf')
  expect(mockEvents.removeFile).not.toHaveBeenCalled()
  await click('Delete Programme.pdf')
  expect(mockEvents.removeFile).toHaveBeenCalledWith('event-1', 'pdf-1')
  expect(button('Preview Programme.pdf')).toBeUndefined()
})

it('uploads from the file input, resets it, and retains files when switching tabs', async () => {
  mockEvents.workspace.mockResolvedValue({ ...workspace, files: [] })
  await render()
  const input = document.querySelector('input[type="file"]')
  Object.defineProperty(input, 'files', { value: [new File(['hello'], 'Programme.pdf', { type: 'application/pdf' })] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  expect(input.value).toBe('')
  expect(button('Preview Programme.pdf')).toBeDefined()
  await click('Guests')
  expect(mockReplace).toHaveBeenCalledWith('/account/events/event-1?tab=guests', { scroll: false })
  mockSearch = 'tab=guests'; await render()
  expect(text()).toContain('Guest list')
  mockSearch = 'tab=files'; await render()
  expect(button('Preview Programme.pdf')).toBeDefined()
  expect(mockEvents.workspace).toHaveBeenCalledTimes(1)
})

it('validates every file before creating any upload session', async () => {
  await render(<Harness />)
  await act(async () => { await manager.addFiles([new File(['pdf'], 'good.pdf', { type: 'application/pdf' }), new File(['html'], 'bad.html', { type: 'text/html' })]) })
  expect(manager.error).toContain('must be a PDF')
  expect(mockEvents.createFileUploadSession).not.toHaveBeenCalled()
})

it('retries an uncertain finalisation without uploading a duplicate and supports read-only reconciliation', async () => {
  mockEvents.finalizeFile.mockRejectedValueOnce(new TypeError('lost response'))
  await render(<Harness />)
  await act(async () => { await manager.addFiles([new File(['pdf'], 'Programme.pdf', { type: 'application/pdf' })]) })
  expect(manager.uploads[0]).toMatchObject({ step: 'finalize', uploadId: pdf.id })
  await render(<Harness canManage={false} />)
  await act(async () => { await manager.retryUpload(manager.uploads[0]) })
  expect(manager.files).toEqual([pdf])
  expect(global.XMLHttpRequest).toHaveBeenCalledTimes(1)
  expect(mockEvents.removeFile).not.toHaveBeenCalled()
})

it('reconciles a lost response from the refreshed workspace', async () => {
  mockEvents.finalizeFile.mockRejectedValueOnce(new TypeError('lost response'))
  await render(<Harness />)
  await act(async () => { await manager.addFiles([new File(['pdf'], 'Programme.pdf', { type: 'application/pdf' })]) })
  await act(async () => manager.replaceFiles([pdf]))
  expect(manager.uploads).toEqual([])
})

it('keeps partial success and exposes failed upload cleanup', async () => {
  mockEvents.createFileUploadSession.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...session, upload_id: 'file-2' })
  mockEvents.finalizeFile.mockResolvedValueOnce(pdf).mockRejectedValueOnce(new TsheloApiError(409, null, { code: 'CONFLICT', message: 'Cleanup pending', retryable: false, details: { event_id: 'event-1', upload_id: 'file-2', cleanup_pending: true } }))
  await render(<Harness />)
  await act(async () => { await manager.addFiles([new File(['one'], 'Programme.pdf', { type: 'application/pdf' }), new File(['two'], 'Map.pdf', { type: 'application/pdf' })]) })
  expect(manager.files).toEqual([pdf])
  expect(manager.uploads[0]).toMatchObject({ step: 'cleanup', uploadId: 'file-2' })
  await render(<Harness canManage={false} />)
  await act(async () => { await manager.retryUpload(manager.uploads[0]) })
  expect(mockEvents.removeFile).toHaveBeenCalledWith('event-1', 'file-2')
})

it('retains deletion recovery after completion and keeps denied files readable', async () => {
  mockEvents.removeFile.mockRejectedValueOnce(new TypeError('offline'))
  await render(<Harness />)
  await act(async () => manager.replaceFiles([pdf]))
  await act(async () => { await manager.confirmRemove(pdf) })
  expect(manager.removals[0].error).toContain('connection')
  await render(<Harness canManage={false} />)
  await act(async () => { await manager.retryRemove(pdf) })
  expect(manager.files).toEqual([])
  await render(<Harness />)
  mockEvents.removeFile.mockRejectedValueOnce(new TsheloApiError(403, null, { code: 'FORBIDDEN', message: 'Read-only', retryable: false }))
  await act(async () => manager.replaceFiles([pdf]))
  await act(async () => { await manager.confirmRemove(pdf) })
  expect(manager.files).toEqual([pdf])
  expect(manager.removals).toEqual([])
})

it('sends only storage headers and the binary File, with bounded upload time and progress', async () => {
  const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' })
  const progress = jest.fn()
  await transferEventFile({ name: file.name, uri: '', file }, session, progress)
  expect(xhr.open).toHaveBeenCalledWith('PUT', session.upload_url)
  expect(xhr.setRequestHeader.mock.calls).toEqual([['content-type', 'application/pdf'], ['x-upsert', 'false']])
  expect(xhr.withCredentials).toBe(false)
  expect(xhr.timeout).toBe(120000)
  expect(xhr.send).toHaveBeenCalledWith(file)
  expect(progress).toHaveBeenCalledWith(50)
})
