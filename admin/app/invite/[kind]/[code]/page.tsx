import type { Metadata, Route } from 'next'
import { notFound, redirect } from 'next/navigation'
import { invitationAccountPath, normalizeInvitationCode, type InvitationKind } from '@shared/invitations'

export const metadata: Metadata = {
  title: 'Tshelo invitation',
  description: 'Open your Tshelo invitation to join an event or fund.',
}

type InvitePageProps = {
  params: Promise<{ kind: string; code: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { kind, code: rawCode } = await params
  const code = normalizeInvitationCode(rawCode)
  if ((kind !== 'event' && kind !== 'fund') || !code) notFound()

  redirect(invitationAccountPath({ kind: kind as InvitationKind, code }) as Route)
}
