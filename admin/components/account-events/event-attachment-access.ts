import type { EventAnnouncementAttachment, EventAnnouncementAttachmentAccess, EventFile, EventFileAccess } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { runApiRead } from '@/lib/api-ui'
import type { ApiCallOptions } from '@shared/api-client'

export type EventAttachment = EventAnnouncementAttachment | EventFile

async function eventAttachmentAccess(eventId: string, attachment: EventAttachment, signal?: AbortSignal) {
  return runApiRead<EventFileAccess | EventAnnouncementAttachmentAccess>((call: ApiCallOptions) => 'id' in attachment
    ? createApiClient().events.createFileAccess(eventId, attachment.id, call)
    : createApiClient().events.createAnnouncementAttachmentAccess(eventId, { object_path: attachment.object_path }, call), signal)
}

export async function eventAttachmentUrl(eventId: string, attachment: EventAttachment, signal?: AbortSignal) {
  const access = await eventAttachmentAccess(eventId, attachment, signal)
  return access.download_url
}

export async function eventAttachmentThumbnailUrl(
  eventId: string,
  attachment: EventAttachment,
  variant: 'thumbnail' | 'banner',
  signal?: AbortSignal,
) {
  // Announcement attachments retain their existing private access path. The
  // low-data transformed URLs are currently available for event-wide files.
  if (!('id' in attachment)) return eventAttachmentUrl(eventId, attachment, signal)
  const access = await runApiRead<EventFileAccess>((call: ApiCallOptions) =>
    createApiClient().events.createFileAccess(eventId, attachment.id, call), signal)
  const url = variant === 'banner' ? access.banner_thumbnail_url : access.thumbnail_url
  if (!url) throw new Error('A low-data image preview is unavailable.')
  return url
}
