import type { EventAnnouncementAttachment, EventFile } from '@shared/contracts'
import { api } from '../../../lib/api'
import { runApiRead } from '../../../lib/apiScreen'

export type EventAttachment = EventAnnouncementAttachment | EventFile

/** Always request fresh access for an interaction; private URLs expire quickly. */
export async function eventAttachmentUrl(eventId: string, attachment: EventAttachment) {
  const access = await runApiRead<{ download_url: string }>(call => 'id' in attachment
    ? api.events.createFileAccess(eventId, attachment.id, call)
    : api.events.createAnnouncementAttachmentAccess(eventId, { object_path: attachment.object_path }, call))
  return access.download_url
}
