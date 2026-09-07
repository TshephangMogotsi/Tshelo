import { invitationUrl } from '@shared/invitations'

export function fundPreviewUrl(fundCode: string): string {
  return invitationUrl('fund', fundCode)
}

export function eventInvitationUrl(eventCode: string): string {
  return invitationUrl('event', eventCode)
}
