import type { EventAnnouncementAttachment, EventFile } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { runApiRead } from '@/lib/api-ui'
import type { ApiCallOptions } from '@shared/api-client'

export type EventAttachment = EventAnnouncementAttachment | EventFile

export async function eventAttachmentUrl(eventId: string, attachment: EventAttachment, signal?: AbortSignal) {
  const access = await runApiRead<{ download_url: string }>((call: ApiCallOptions) => 'id' in attachment
    ? createApiClient().events.createFileAccess(eventId, attachment.id, call)
    : createApiClient().events.createAnnouncementAttachmentAccess(eventId, { object_path: attachment.object_path }, call), signal)
  return access.download_url
}
