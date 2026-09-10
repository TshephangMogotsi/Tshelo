jest.mock('@/lib/api-client', () => ({ createApiClient: () => ({ events: mockEvents }) }))
jest.mock('@/lib/home-summary-cache', () => ({ invalidateHomeSummary: jest.fn() }))
jest.mock('@/components/account-events/event-guests', () => ({ EventGuests: () => <p>Guest list</p> }))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/account/events/event-1',
  useSearchParams: () => new URLSearchParams(mockSearch),
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, ...props }) => <a {...props}>{children}</a> }))
jest.mock('next/image', () => ({ __esModule: true, default: ({ unoptimized: _unoptimized, fill: _fill, ...props }) => <img {...props} /> }))

const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { EventWorkspaceView } = require('@/components/account-events/event-workspace')
const { EventAttachments } = require('@/components/account-events/event-attachments')
const { useEventFiles, transferEventFile } = require('@/components/account-events/use-event-files')
const { TsheloApiError } = require('@shared/api-client')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mockEvents = { workspace: jest.fn(), update: jest.fn(), createFileAccess: jest.fn(), createAnnouncementAttachmentAccess: jest.fn(), createFileUploadSession: jest.fn(), finalizeFile: jest.fn(), removeFile: jest.fn(), updateBanner: jest.fn(), setAnnouncementPin: jest.fn() }
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
  mockEvents.update.mockResolvedValue(workspace.event)
  mockEvents.createFileAccess.mockImplementation(async (_event, id) => ({
    download_url: `https://storage.test/${id}/full`,
    thumbnail_url: `https://storage.test/${id}/thumbnail`,
    banner_thumbnail_url: `https://storage.test/${id}/banner`,
  }))
  mockEvents.createAnnouncementAttachmentAccess.mockResolvedValue({ download_url: 'https://storage.test/announcement' })
  mockEvents.createFileUploadSession.mockResolvedValue(session)
  mockEvents.finalizeFile.mockResolvedValue(pdf)
  mockEvents.removeFile.mockResolvedValue({ file_id: pdf.id })
  mockEvents.updateBanner.mockImplementation(async (_event, input) => ({
    ...input,
    focal_x: input.focal_x ?? 0.5,
    focal_y: input.focal_y ?? 0.5,
  }))
  mockEvents.setAnnouncementPin.mockImplementation(async (_event, id, input) => ({ id, ...input }))
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
  const thumbnail = document.querySelector('[aria-label="Event images"] img')
  expect(thumbnail.getAttribute('src')).toBe('https://storage.test/image-1/thumbnail')
  expect(thumbnail.getAttribute('loading')).toBe('lazy')
  expect(document.querySelector('[aria-label="Event documents"]').textContent).toContain('Programme.pdf')
  expect(button('Add files')).toBeDefined()
  expect(button('View full image Venue.jpg').textContent).toBe('')
  expect(button('Download Venue.jpg').textContent).toBe('')
  expect(button('Delete Venue.jpg').textContent).toBe('')
  expect(button('Delete Programme.pdf')).toBeDefined()
})

it('presents the event overview as a hero with previews and contextual actions', async () => {
  mockSearch = ''
  const secondPhoto = { ...photo, id: 'image-2', object_path: 'event-1/image-2', file_name: 'Tables.jpg' }
  mockEvents.workspace.mockResolvedValue({
    ...workspace,
    event: {
      ...workspace.event,
      event_code: 'EVENT-1234', share_code: 'SHARE-1234', event_type: 'wedding', event_emoji: '💍',
      event_date: '2026-09-19', event_time: '14:00:00', event_end_date: '2026-09-19', event_end_time: '20:00:00',
      time_zone: 'Africa/Gaborone', rsvp_deadline: '2026-09-18',
      venue_name: 'Garden Hall', venue_address: 'Plot 12, Gaborone', venue_lat: null, venue_lng: null,
      description: 'Join us for the celebration.',
    },
    guests: [
      { id: 'guest-1', guest_name: 'Kago Molefe', rsvp_status: 'yes', plus_ones: 1 },
      { id: 'guest-2', guest_name: 'Neo Dube', rsvp_status: 'pending', plus_ones: 0 },
    ],
    announcements: [{ id: 'update-1', title: 'Final details', body: 'Please arrive by 13:30.', created_at: '2026-09-08T12:00:00Z', attachments: [] }],
    files: [{ ...photo, is_banner: true }, secondPhoto, pdf],
    budget: { total_budget: '12000', currency_code: 'BWP' },
  })
  await render()
  expect(document.querySelector('#event-title').textContent).toBe('Garden party')
  expect(document.querySelector('.member-event-date-strip').textContent).toContain('Garden Hall')
  expect(document.querySelector('.member-event-schedule-facts').textContent).toContain('6 hours')
  expect(document.querySelector('.member-event-schedule-facts').textContent).toContain('18 Sept 2026')
  expect(document.querySelector('.member-event-schedule-facts').textContent).toContain('Africa/Gaborone · UTC+2')
  expect(button('Add to calendar')).toBeDefined()
  expect(button('Share invite')).toBeDefined()
  expect(button('Copy invitation code')).toBeDefined()
  expect(button('Manage event')).toBeUndefined()
  expect(document.querySelector('.member-event-attendance-card').textContent).toContain('Confirmed')
  expect(document.querySelector('.member-event-attendance-card [title="Kago Molefe"]').textContent).toBe('KM')
  expect(document.querySelector('.member-event-latest-update').textContent).toContain('Final details')
  expect(document.querySelector('.member-event-budget-preview').textContent).toContain('12,000')
  expect(document.querySelector('.member-event-location-card a').href).toContain('google.com/maps/search')
  expect(document.querySelectorAll('.member-event-gallery-preview img')).toHaveLength(2)
  expect(document.querySelector('#event-workspace-panel').firstElementChild).toBe(document.querySelector('[aria-label="Banner for Garden party"]'))
  await act(async () => document.querySelector('.member-event-gallery-preview header button').click())
  expect(mockReplace).toHaveBeenLastCalledWith('/account/events/event-1?tab=files', { scroll: false })
})

it('shows RSVP instead of organiser actions for an attendee', async () => {
  mockSearch = ''
  mockEvents.workspace.mockResolvedValue({ ...workspace, capabilities: { is_creator: false, is_organiser: false, can_leave_event: true, linked_fund_permissions: [] } })
  await render()
  expect(button('RSVP')).toBeDefined()
  expect(button('Share invite')).toBeUndefined()
  expect(button('Manage event')).toBeUndefined()
  await click('RSVP')
  expect(mockReplace).toHaveBeenLastCalledWith('/account/events/event-1?tab=guests', { scroll: false })
})

it('promotes the single pinned announcement on Overview and lets managers replace it', async () => {
  const pinned = { id: 'update-1', title: 'Venue changed', body: 'Use the north entrance.', created_at: '2026-09-08T12:00:00Z', is_pinned: true, attachments: [] }
  const latest = { id: 'update-2', title: 'Later reminder', body: 'Doors open at 18:00.', created_at: '2026-09-09T12:00:00Z', is_pinned: false, attachments: [] }
  mockSearch = ''
  mockEvents.workspace.mockResolvedValue({ ...workspace, announcements: [latest, pinned] })
  await render()
  expect(document.querySelector('.member-event-pinned-update-card').textContent).toContain('Venue changed')
  expect(document.querySelector('.member-event-pinned-update-card').textContent).not.toContain('Later reminder')

  mockSearch = 'tab=announcements'
  await act(async () => root.unmount())
  root = createRoot(container)
  await render()
  expect(document.querySelector('.member-announcements article:first-child').textContent).toContain('Venue changed')
  expect(button('Unpin Venue changed').querySelector('svg').getAttribute('fill')).toBe('currentColor')
  await click('Pin Later reminder to Overview')
  expect(window.confirm).toHaveBeenCalledWith('Replace “Venue changed” as the pinned Overview update?')
  expect(mockEvents.setAnnouncementPin).toHaveBeenCalledWith('event-1', 'update-2', { is_pinned: true })
  expect(button('Pin Later reminder to Overview').classList.contains('pin-pulse')).toBe(true)
  expect(button('Pin Later reminder to Overview').querySelector('svg').getAttribute('fill')).toBe('currentColor')
})

it('edits the RSVP deadline and IANA time zone through the existing Settings flow', async () => {
  mockSearch = 'tab=settings'
  mockEvents.workspace.mockResolvedValue({
    ...workspace,
    event: {
      ...workspace.event,
      name: 'Garden party', description: null, event_date: '2026-09-19', event_time: '14:00:00',
      event_end_date: '2026-09-19', event_end_time: '20:00:00', time_zone: 'Africa/Gaborone',
      rsvp_deadline: null, venue_name: 'Garden Hall', venue_address: null,
    },
  })
  await render()
  const form = document.querySelector('.member-settings-form')
  form.elements.namedItem('rsvp_deadline').value = '2026-09-18'
  form.elements.namedItem('time_zone').value = 'Africa/Johannesburg'
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(mockEvents.update).toHaveBeenCalledWith('event-1', expect.objectContaining({
    rsvp_deadline: '2026-09-18',
    time_zone: 'Africa/Johannesburg',
  }))
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
  expect(document.querySelector('iframe').getAttribute('src')).toBe('https://storage.test/pdf-1/full')
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
  expect(global.fetch).toHaveBeenCalledWith('https://storage.test/pdf-1/full')
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
  expect(text()).toContain('Low-data preview unavailable')
  await click('Retry thumbnail for Venue.jpg')
  expect(mockEvents.createFileAccess).toHaveBeenCalledTimes(2)
  expect(button('Preview Programme.pdf')).toBeDefined()
})

it('does not download the original when a compressed preview is unavailable', async () => {
  mockEvents.createFileAccess.mockImplementation(async (_event, id) => ({ download_url: `https://storage.test/${id}/full` }))
  await render()
  expect(document.querySelector('[aria-label="Event images"] img')).toBeNull()
  expect(text()).toContain('Low-data preview unavailable')
  await click('View full image Venue.jpg')
  expect(document.querySelector('img[alt="Preview of Venue.jpg"]').src).toBe('https://storage.test/image-1/full')
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

describe('web event banner', () => {
  beforeEach(() => { mockSearch = '' })
  const bannerSection = () => document.querySelector('[aria-label="Banner for Garden party"]')
  async function chooseImage(id) {
    const select = bannerSection().querySelector('select')
    await act(async () => { select.value = id; select.dispatchEvent(new Event('change', { bubbles: true })) })
  }
  async function chooseUpload(file) {
    const input = document.querySelector('[aria-label="Upload event banner"]')
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  }
  async function chooseFocalPoint(x, y) {
    const horizontal = bannerSection().querySelector('[aria-label="Horizontal focal point"]')
    const vertical = bannerSection().querySelector('[aria-label="Vertical focal point"]')
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    await act(async () => {
      setValue.call(horizontal, String(x)); horizontal.dispatchEvent(new Event('input', { bubbles: true }))
      setValue.call(vertical, String(y)); vertical.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  function withBanner(extra = {}) {
    mockEvents.workspace.mockResolvedValue({ ...workspace, files: [{ ...photo, is_banner: true }, pdf], ...extra })
  }

  it('selects an existing image as the first Overview item without uploading or deleting bytes', async () => {
    await render()
    expect(bannerSection().textContent).toContain('Give your event a cover')
    await click('Add banner')
    expect([...bannerSection().querySelectorAll('option')].map(option => option.textContent)).not.toContain(pdf.file_name)
    await chooseImage(photo.id)
    await click('Use as banner')
    expect(mockEvents.updateBanner).toHaveBeenCalledWith('event-1', { file_id: photo.id, focal_x: 0.5, focal_y: 0.5 })
    expect(mockEvents.createFileUploadSession).not.toHaveBeenCalled()
    expect(mockEvents.removeFile).not.toHaveBeenCalled()
    expect(bannerSection().querySelector('img').src).toBe('https://storage.test/image-1/banner')
    expect(bannerSection().querySelector('img').getAttribute('loading')).toBe('eager')
    expect(button(`View full image ${photo.file_name}`).textContent).toBe('')
    expect(bannerSection().textContent).toContain('Event banner updated.')
  })

  it('uploads through the shared lifecycle, then waits for focal-point confirmation before selecting it', async () => {
    mockEvents.finalizeFile.mockResolvedValue(photo)
    await render()
    await click('Add banner')
    await chooseUpload(new File(['image'], photo.file_name, { type: photo.content_type }))
    expect(mockEvents.finalizeFile).toHaveBeenCalled()
    expect(mockEvents.updateBanner).not.toHaveBeenCalled()
    expect(bannerSection().textContent).toContain('Choose its important point')
    await chooseFocalPoint(25, 70)
    await click('Use as banner')
    expect(mockEvents.updateBanner).toHaveBeenCalledWith('event-1', { file_id: photo.id, focal_x: 0.25, focal_y: 0.7 })
    expect(mockEvents.finalizeFile.mock.invocationCallOrder[0]).toBeLessThan(mockEvents.updateBanner.mock.invocationCallOrder[0])
    expect(bannerSection().querySelector('img')).not.toBeNull()
  })

  it.each([
    ['document.pdf', 'application/pdf', 5], ['vector.svg', 'image/svg+xml', 5],
    ['empty.jpg', 'image/jpeg', 0], ['huge.jpg', 'image/jpeg', 10485761],
  ])('rejects invalid banner input %s before requesting an upload session', async (name, type, size) => {
    await render(); await click('Add banner')
    const file = new File(['test'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    await chooseUpload(file)
    expect(bannerSection().querySelector('[role="alert"]')).not.toBeNull()
    expect(mockEvents.createFileUploadSession).not.toHaveBeenCalled()
    expect(mockEvents.updateBanner).not.toHaveBeenCalled()
  })

  it('keeps the current banner and provides recovery for a failed upload', async () => {
    withBanner()
    mockEvents.finalizeFile.mockRejectedValueOnce(new TypeError('offline'))
    await render(); await click('Change banner')
    await chooseUpload(new File(['image'], 'New.jpg', { type: 'image/jpeg' }))
    expect(bannerSection().querySelector('img').src).toBe('https://storage.test/image-1/banner')
    expect(text()).toContain('Open Files to retry')
    expect(button('View files')).toBeDefined()
    expect(mockEvents.updateBanner).not.toHaveBeenCalled()
    expect(mockEvents.removeFile).not.toHaveBeenCalled()
  })

  it('retains a new published file when banner selection fails, allowing a no-upload retry', async () => {
    withBanner()
    const next = { ...photo, id: 'image-2', object_path: 'event-1/image-2', file_name: 'New.jpg' }
    mockEvents.finalizeFile.mockResolvedValue(next)
    mockEvents.updateBanner.mockRejectedValueOnce(new TypeError('offline'))
    await render(); await click('Change banner')
    await chooseUpload(new File(['image'], next.file_name, { type: 'image/jpeg' }))
    await click('Use as banner')
    expect(bannerSection().querySelector('img').src).toBe('https://storage.test/image-1/banner')
    expect(bannerSection().textContent).toContain('without uploading it again')
    expect(mockEvents.removeFile).not.toHaveBeenCalled()
    await click('Use as banner')
    expect(mockEvents.createFileUploadSession).toHaveBeenCalledTimes(1)
    expect(bannerSection().querySelector('img').src).toBe('https://storage.test/image-2/banner')
  })

  it('confirms banner removal and preserves the image in Files', async () => {
    withBanner(); await render()
    window.confirm.mockReturnValueOnce(false)
    await click('Remove banner')
    expect(mockEvents.updateBanner).not.toHaveBeenCalled()
    await click('Remove banner')
    expect(mockEvents.updateBanner).toHaveBeenCalledWith('event-1', { file_id: null })
    expect(mockEvents.removeFile).not.toHaveBeenCalled()
    expect(bannerSection().querySelector('img')).toBeNull()
    mockSearch = 'tab=files'; await render()
    expect(document.querySelector('[aria-label="Event images"] img')).not.toBeNull()
  })

  it('shows errors when banner removal fails even with the editor closed', async () => {
    withBanner(); mockEvents.updateBanner.mockRejectedValueOnce(new TypeError('offline'))
    await render(); await click('Remove banner')
    expect(bannerSection().querySelector('[role="alert"]').textContent).toContain('could not be confirmed')
    expect(bannerSection().querySelector('img')).not.toBeNull()
  })

  it('clears the banner when its file is deleted, with an explicit warning', async () => {
    withBanner(); await render()
    mockSearch = 'tab=files'; await render(); await click(`Delete ${photo.file_name}`)
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('also remove the event banner'))
    mockSearch = ''; await render()
    expect(bannerSection().querySelector('img')).toBeNull()
    expect(mockEvents.removeFile).toHaveBeenCalledWith('event-1', photo.id)
  })

  it.each([
    ['guest', { is_creator: false, is_organiser: false, linked_fund_permissions: [] }, 'active'],
    ['fund member', { is_creator: false, is_organiser: false, linked_fund_permissions: [] }, 'active'],
    ['completed creator', workspace.capabilities, 'completed'],
    ['cancelled creator', workspace.capabilities, 'cancelled'],
  ])('shows a read-only banner for %s with the existing preview and zoom viewer', async (_name, capabilities, status) => {
    withBanner({ capabilities, event: { ...workspace.event, status } }); await render()
    expect(button('Change banner')).toBeUndefined()
    expect(button('Remove banner')).toBeUndefined()
    expect(bannerSection().querySelector('img')).not.toBeNull()
    await click(`View full image ${photo.file_name}`)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.querySelector(`img[alt="Preview of ${photo.file_name}"]`).src).toBe('https://storage.test/image-1/full')
    expect(button('Zoom in')).toBeDefined()
    await click('Close attachment preview')
  })

  it.each([
    { is_creator: false, is_organiser: true, linked_fund_permissions: [] },
    { is_creator: false, is_organiser: false, linked_fund_permissions: ['post_event_announcements'] },
  ])('allows organisers and delegated update/file administrators to manage the banner', async capabilities => {
    withBanner({ capabilities }); await render()
    expect(button('Change banner')).toBeDefined()
  })

  it('allows an existing image at the file limit while blocking new uploads', async () => {
    withBanner({ files: Array.from({ length: 10 }, (_, index) => ({ ...photo, id: `image-${index}`, object_path: `event-1/image-${index}` })) })
    await render(); await click('Add banner')
    expect(button('Upload new image').disabled).toBe(true)
    await chooseImage('image-1'); await click('Use as banner')
    expect(mockEvents.updateBanner).toHaveBeenCalledWith('event-1', { file_id: 'image-1', focal_x: 0.5, focal_y: 0.5 })
  })

  it('keeps the chosen point visible and saves keyboard-accessible focal controls', async () => {
    withBanner({ files: [{ ...photo, is_banner: true, banner_focal_x: 0.2, banner_focal_y: 0.8 }, pdf] })
    await render()
    expect(bannerSection().querySelector('img').style.objectPosition).toBe('20% 80%')
    await click('Change banner')
    expect(bannerSection().querySelector('[aria-label="Horizontal focal point"]').value).toBe('20')
    expect(bannerSection().querySelector('[aria-label="Vertical focal point"]').value).toBe('80')
    await chooseFocalPoint(31, 67)
    await click('Save banner')
    expect(mockEvents.updateBanner).toHaveBeenLastCalledWith('event-1', { file_id: photo.id, focal_x: 0.31, focal_y: 0.67 })
    expect(bannerSection().querySelector('img').style.objectPosition).toBe('31% 67%')
  })

  it('shows a retry state when a private banner image fails to load', async () => {
    withBanner(); await render()
    await act(async () => bannerSection().querySelector('img').dispatchEvent(new Event('error')))
    expect(bannerSection().textContent).toContain('Low-data preview unavailable')
    await click(`Retry thumbnail for ${photo.file_name}`)
    expect(bannerSection().querySelector('img')).not.toBeNull()
  })
})
