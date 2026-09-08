jest.mock('../../../../lib/api', () => ({ api: { events: { createFileAccess: jest.fn(), createAnnouncementAttachmentAccess: jest.fn() } } }))
import { api } from '../../../../lib/api'
import { eventAttachmentUrl } from '../attachmentAccess'
import type { EventAnnouncementAttachment, EventFile } from '@shared/contracts'

const attachment: EventAnnouncementAttachment = { object_path: 'event/user/photo.jpg', file_name: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 10 }
const file: EventFile = { ...attachment, id: 'file-1', event_id: 'event-1', uploaded_by: 'user-1', created_at: 'now', updated_at: 'now' }

beforeEach(() => jest.resetAllMocks())

it('uses file IDs for event file access and requests fresh access each time', async () => {
  ;(api.events.createFileAccess as jest.Mock).mockResolvedValueOnce({ download_url: 'first-url' }).mockResolvedValueOnce({ download_url: 'fresh-url' })
  await expect(eventAttachmentUrl('event-1', file)).resolves.toBe('first-url')
  await expect(eventAttachmentUrl('event-1', file)).resolves.toBe('fresh-url')
  expect(api.events.createFileAccess).toHaveBeenCalledTimes(2)
  expect(api.events.createFileAccess).toHaveBeenCalledWith('event-1', 'file-1', expect.any(Object))
  expect(api.events.createAnnouncementAttachmentAccess).not.toHaveBeenCalled()
})

it('preserves announcement attachment access through the shared viewer', async () => {
  ;(api.events.createAnnouncementAttachmentAccess as jest.Mock).mockResolvedValue({ download_url: 'announcement-url' })
  await expect(eventAttachmentUrl('event-1', attachment)).resolves.toBe('announcement-url')
  expect(api.events.createAnnouncementAttachmentAccess).toHaveBeenCalledWith('event-1', { object_path: attachment.object_path }, expect.any(Object))
  expect(api.events.createFileAccess).not.toHaveBeenCalled()
})
