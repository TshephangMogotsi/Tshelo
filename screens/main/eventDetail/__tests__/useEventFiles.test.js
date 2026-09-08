jest.mock('../../../../lib/api', () => ({ api: { events: { createFileUploadSession: jest.fn(), finalizeFile: jest.fn(), removeFile: jest.fn() } } }))
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }))
jest.mock('expo-file-system/legacy', () => ({ createUploadTask: jest.fn(), getInfoAsync: jest.fn(), FileSystemUploadType: { BINARY_CONTENT: 0 } }))

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Alert } = require('react-native')
const picker = require('expo-document-picker')
const fs = require('expo-file-system/legacy')
const { api } = require('../../../../lib/api')
const { TsheloApiError } = require('@shared/api-client')
const { useEventFiles } = require('../useEventFiles')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const asset = { uri: 'file:///programme.pdf', name: 'Programme.pdf', mimeType: 'application/pdf', size: 100 }
const file = { id: 'file-1', event_id: 'event-1', uploaded_by: 'user-1', file_name: asset.name, object_path: 'event-1/file', content_type: asset.mimeType, size_bytes: asset.size, created_at: '2026-09-08T12:00:00Z', updated_at: '2026-09-08T12:00:00Z' }
const session = { ...file, upload_id: file.id, upload_url: 'https://storage.test/signed-upload', expires_at: '2026-09-08T14:00:00Z' }
let manager
let tree
function Harness({ canManage }) { manager = useEventFiles('event-1', canManage); return null }
async function mount(canManage = true) { await act(async () => { tree = create(React.createElement(Harness, { canManage })) }) }

beforeEach(() => {
  jest.clearAllMocks()
  picker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [asset] })
  api.events.createFileUploadSession.mockResolvedValue(session)
  api.events.finalizeFile.mockResolvedValue(file)
  api.events.removeFile.mockResolvedValue({ file_id: file.id })
  fs.createUploadTask.mockImplementation((_url, _uri, _options, progress) => ({ uploadAsync: async () => { progress({ totalBytesSent: 100, totalBytesExpectedToSend: 100 }); return { status: 200 } } }))
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks() })

it('uploads native binary content without leaking API auth and keeps files across rerenders', async () => {
  await mount()
  await act(async () => { await manager.addFiles() })
  expect(picker.getDocumentAsync).toHaveBeenCalledWith(expect.objectContaining({ multiple: true, copyToCacheDirectory: true }))
  expect(fs.createUploadTask).toHaveBeenCalledWith(session.upload_url, asset.uri, {
    httpMethod: 'PUT', uploadType: 0, headers: { 'content-type': 'application/pdf', 'x-upsert': 'false' },
  }, expect.any(Function))
  expect(manager.files).toEqual([file])
  expect(manager.uploads).toEqual([])
  expect(manager.busy).toBe(false)
  await act(async () => tree.update(React.createElement(Harness, { canManage: false })))
  expect(manager.files).toEqual([file])
  await act(async () => { await manager.addFiles() })
  expect(picker.getDocumentAsync).toHaveBeenCalledTimes(1)
})

it('validates the whole selection before reserving any slots', async () => {
  picker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [asset, { ...asset, name: 'unsafe.html', mimeType: 'text/html' }] })
  await mount()
  await act(async () => { await manager.addFiles() })
  expect(manager.error).toContain('must be a PDF')
  expect(api.events.createFileUploadSession).not.toHaveBeenCalled()
})

it('handles picker cancellation without an error or upload', async () => {
  picker.getDocumentAsync.mockResolvedValue({ canceled: true })
  await mount()
  await act(async () => { await manager.addFiles() })
  expect(manager.error).toBeNull()
  expect(manager.busy).toBe(false)
  expect(api.events.createFileUploadSession).not.toHaveBeenCalled()
})

it('keeps partial success and retries only the uncertain save', async () => {
  picker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [asset, { ...asset, name: 'Map.pdf' }] })
  api.events.createFileUploadSession.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...session, upload_id: 'file-2' })
  api.events.finalizeFile.mockResolvedValueOnce(file).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ ...file, id: 'file-2' })
  await mount()
  await act(async () => { await manager.addFiles() })
  expect(manager.files).toEqual([file])
  expect(manager.uploads).toHaveLength(1)
  expect(manager.uploads[0].step).toBe('finalize')
  await act(async () => { await manager.retryUpload(manager.uploads[0]) })
  expect(manager.files).toHaveLength(2)
  expect(manager.uploads).toHaveLength(0)
  expect(fs.createUploadTask).toHaveBeenCalledTimes(2)
  expect(api.events.removeFile).not.toHaveBeenCalled()
})

it('reconciles an uncertain save from the refreshed workspace', async () => {
  api.events.finalizeFile.mockRejectedValueOnce(new TypeError('response lost'))
  await mount()
  await act(async () => { await manager.addFiles() })
  expect(manager.uploads).toHaveLength(1)
  await act(async () => manager.replaceFiles([file]))
  expect(manager.uploads).toHaveLength(0)
  expect(manager.files).toEqual([file])
})

it('requires confirmation, retains deletion failures, and can retry cleanup read-only', async () => {
  api.events.removeFile.mockRejectedValueOnce(new TypeError('offline'))
  await mount()
  await act(async () => manager.replaceFiles([file]))
  manager.confirmRemove(file)
  expect(api.events.removeFile).not.toHaveBeenCalled()
  const buttons = Alert.alert.mock.calls[0][2]
  expect(buttons[0]).toEqual({ text: 'Cancel', style: 'cancel' })
  await act(async () => { await buttons[1].onPress() })
  expect(manager.removals[0].error).toContain('connection')
  await act(async () => tree.update(React.createElement(Harness, { canManage: false })))
  await act(async () => { await manager.retryRemove(file) })
  expect(manager.removals).toEqual([])
  expect(manager.files).toEqual([])
})

it('rechecks permission after a deletion confirmation was opened', async () => {
  await mount()
  manager.confirmRemove(file)
  const confirm = Alert.alert.mock.calls[0][2][1].onPress
  await act(async () => tree.update(React.createElement(Harness, { canManage: false })))
  await act(async () => { await confirm() })
  expect(api.events.removeFile).not.toHaveBeenCalled()
})

it('keeps a file readable when the server rejects deletion after permission loss', async () => {
  api.events.removeFile.mockRejectedValueOnce(new TsheloApiError(403, null, { code: 'FORBIDDEN', message: 'This event is read-only.', retryable: false }))
  await mount()
  await act(async () => manager.replaceFiles([file]))
  manager.confirmRemove(file)
  await act(async () => { await Alert.alert.mock.calls[0][2][1].onPress() })
  expect(manager.removals).toEqual([])
  expect(manager.files).toEqual([file])
  expect(manager.error).toContain('read-only')
})

it('ignores repeated Add taps while the picker/upload is active', async () => {
  let finishPicker
  picker.getDocumentAsync.mockReturnValue(new Promise(resolve => { finishPicker = resolve }))
  await mount()
  let first
  await act(async () => { first = manager.addFiles(); await manager.addFiles() })
  expect(manager.busy).toBe(true)
  expect(picker.getDocumentAsync).toHaveBeenCalledTimes(1)
  await act(async () => { finishPicker({ canceled: true }); await first })
  expect(manager.busy).toBe(false)
})
